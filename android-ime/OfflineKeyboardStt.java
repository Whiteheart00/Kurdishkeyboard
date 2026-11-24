package io.kurdikebord.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.media.audiofx.NoiseSuppressor;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.os.Messenger;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.util.concurrent.atomic.AtomicBoolean;

/** Records PCM in the visible IME and delegates recognition to Manga's VekolStt service. */
public final class OfflineKeyboardStt {
    public interface Events { void event(String state, String text); }
    private static final String TAG = "OfflineKeyboardStt";
    private static final String ACTION = "com.mangatranslator.app.action.KEYBOARD_STT";
    private static final String APP = "com.mangatranslator.app";
    private static final String SERVICE = "com.mangatranslator.app.KeyboardSttService";
    private static final int PRELOAD = 1, TRANSCRIBE = 2, STATUS = 3, RESULT = 4, ERROR = 5;
    private static final String PIPE = "pcm_pipe", VALUE = "value";
    private static final int RATE = 16000, MAX_BYTES = RATE * 2 * 60;

    private final Context context;
    private final Events events;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ByteArrayOutputStream pcm = new ByteArrayOutputStream();
    private final AtomicBoolean recording = new AtomicBoolean(false);
    private AudioRecord recorder;
    private NoiseSuppressor noiseSuppressor;
    private Thread recordThread;
    private Messenger remote;
    private boolean bound;
    private final Messenger incoming = new Messenger(new Handler(Looper.getMainLooper(), msg -> {
        Bundle b = msg.getData();
        String value = b == null ? "" : b.getString(VALUE, "");
        if (msg.what == STATUS) {
            if ("ready".equals(value)) events.event("ready", "");
            else events.event("model_missing", "");
        } else if (msg.what == RESULT) {
            events.event("result", value);
            unbind();
        } else if (msg.what == ERROR) {
            events.event("model_missing".equals(value) ? "model_missing" : "error", value);
            unbind();
        }
        return true;
    }));
    private final ServiceConnection connection = new ServiceConnection() {
        @Override public void onServiceConnected(ComponentName name, android.os.IBinder service) {
            remote = new Messenger(service);
            send(PRELOAD, null);
        }
        @Override public void onServiceDisconnected(ComponentName name) { remote = null; }
    };

    public OfflineKeyboardStt(Context context, Events events) {
        this.context = context.getApplicationContext();
        this.events = events;
    }

    @SuppressLint("MissingPermission")
    public synchronized void start() {
        if (recording.get()) { stop(); return; }
        if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            events.event("permission", ""); return;
        }
        try {
            Intent intent = new Intent(ACTION).setPackage(APP).setClassName(APP, SERVICE);
            bound = context.bindService(intent, connection, Context.BIND_AUTO_CREATE);
            if (!bound) { events.event("app_missing", ""); return; }
        } catch (Throwable t) {
            events.event("app_missing", t.getMessage() == null ? "" : t.getMessage()); return;
        }
        int min = AudioRecord.getMinBufferSize(RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (min <= 0) { events.event("error", "audio_unavailable"); return; }
        try {
            recorder = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, RATE,
                    AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min * 4, 8192));
            if (recorder.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("audio_unavailable");
            try { if (NoiseSuppressor.isAvailable()) noiseSuppressor = NoiseSuppressor.create(recorder.getAudioSessionId()); if (noiseSuppressor != null) noiseSuppressor.setEnabled(true); } catch (Throwable ignored) {}
            synchronized (pcm) { pcm.reset(); }
            recorder.startRecording();
            recording.set(true);
            events.event("recording", "");
            recordThread = new Thread(() -> {
                byte[] chunk = new byte[4096];
                try {
                    while (recording.get()) {
                        int n = recorder.read(chunk, 0, chunk.length);
                        if (n <= 0) break;
                        synchronized (pcm) {
                            if (pcm.size() + n > MAX_BYTES) {
                                int take = MAX_BYTES - pcm.size();
                                if (take > 0) pcm.write(chunk, 0, take);
                                main.post(this::stop);
                                break;
                            }
                            pcm.write(chunk, 0, n);
                        }
                    }
                } catch (Throwable t) { Log.w(TAG, "Audio capture stopped", t); }
            }, "kurdi-keyboard-audio");
            recordThread.start();
            main.postDelayed(() -> { if (recording.get()) stop(); }, 60_000);
        } catch (Throwable t) {
            releaseRecorder();
            events.event("error", t.getMessage() == null ? "microphone_failed" : t.getMessage());
            unbind();
        }
    }

    public synchronized void stop() {
        if (!recording.getAndSet(false)) return;
        events.event("transcribing", "");
        try { if (recorder != null) recorder.stop(); } catch (Throwable ignored) {}
        try { if (recordThread != null) recordThread.join(700); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
        releaseRecorder();
        final byte[] audio;
        synchronized (pcm) { audio = pcm.toByteArray(); pcm.reset(); }
        if (audio.length < RATE) { events.event("error", "no_speech"); unbind(); return; }
        if (remote == null) {
            // bind callback may still be pending; retry briefly without holding the UI thread
            new Thread(() -> {
                for (int i = 0; i < 30 && remote == null; i++) try { Thread.sleep(100); } catch (InterruptedException e) { return; }
                main.post(() -> { if (remote == null) { events.event("app_missing", ""); unbind(); } else sendAudio(audio); });
            }, "kurdi-stt-bind-wait").start();
        } else sendAudio(audio);
    }

    public synchronized void cancel() {
        recording.set(false);
        try { if (recorder != null) recorder.stop(); } catch (Throwable ignored) {}
        try { if (recordThread != null) recordThread.join(300); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
        releaseRecorder();
        synchronized (pcm) { pcm.reset(); }
        events.event("cancelled", "");
        unbind();
    }

    private void sendAudio(byte[] audio) {
        try {
            ParcelFileDescriptor[] pipe = ParcelFileDescriptor.createPipe();
            Bundle data = new Bundle();
            data.putParcelable(PIPE, pipe[0]);
            Message msg = Message.obtain(null, TRANSCRIBE);
            msg.setData(data);
            msg.replyTo = incoming;
            remote.send(msg);
            pipe[0].close();
            new Thread(() -> {
                try (OutputStream out = new ParcelFileDescriptor.AutoCloseOutputStream(pipe[1])) { out.write(audio); }
                catch (Throwable t) { Log.e(TAG, "Could not stream audio to Manga", t); }
            }, "kurdi-stt-audio-pipe").start();
        } catch (Throwable t) {
            events.event("error", t.getMessage() == null ? "ipc_failed" : t.getMessage());
            unbind();
        }
    }

    private void send(int what, Bundle data) {
        try {
            Message msg = Message.obtain(null, what);
            if (data != null) msg.setData(data);
            msg.replyTo = incoming;
            if (remote != null) remote.send(msg);
        } catch (Throwable t) { Log.w(TAG, "IPC request failed", t); }
    }

    private void releaseRecorder() {
        if (recorder != null) { try { recorder.release(); } catch (Throwable ignored) {} recorder = null; }
        if (noiseSuppressor != null) { try { noiseSuppressor.release(); } catch (Throwable ignored) {} noiseSuppressor = null; }
        recordThread = null;
    }

    private synchronized void unbind() {
        remote = null;
        if (bound) { try { context.unbindService(connection); } catch (Throwable ignored) {} bound = false; }
    }
}
