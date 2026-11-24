package io.kurdikebord.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.*;
import android.content.pm.PackageManager;
import android.media.*;
import android.media.audiofx.NoiseSuppressor;
import android.os.*;
import android.system.*;
import android.util.Log;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Main-looper state machine; all capture and pipe writes run off the UI thread. */
public final class OfflineKeyboardStt {
    public interface Events { void event(String state, String text); }
    private static final String APP = "com.mangatranslator.app";
    private static final String ACTION = APP + ".action.KEYBOARD_STT";
    private static final int PRELOAD=1, TRANSCRIBE=2, STATUS=3, RESULT=4, ERROR=5, CANCEL=6;
    private static final int RATE=16000, MAX_BYTES=RATE*2*60;
    private final Context context;
    private final Events events;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ThreadPoolExecutor io = new ThreadPoolExecutor(1,1,0,TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(1), r -> new Thread(r,"keyboard-stt-io"));
    private Session active;
    private int nextId;
    private boolean closed;

    private final class Session implements ServiceConnection {
        final int id = ++nextId;
        final AtomicBoolean stop = new AtomicBoolean(), cancelled = new AtomicBoolean();
        final Messenger incoming = new Messenger(new Handler(Looper.getMainLooper(), m -> { receive(this,m); return true; }));
        Messenger remote;
        boolean bound;
        String state = "connecting";
        final Runnable timeout = () -> { if (active == this) finish(this,"error","timeout",true); };
        @Override public void onServiceConnected(ComponentName n, IBinder binder) {
            if (active != this) return;
            remote = new Messenger(binder);
            if (!send(this,PRELOAD,null)) finish(this,"error","ipc_failed",true);
        }
        @Override public void onServiceDisconnected(ComponentName n) { disconnected(); }
        @Override public void onBindingDied(ComponentName n) { disconnected(); }
        @Override public void onNullBinding(ComponentName n) { disconnected(); }
        void disconnected() { if (active == this) finish(this,"error","service_disconnected",true); }
    }
    public OfflineKeyboardStt(Context c, Events e) { context=c.getApplicationContext(); events=e; }
    public void start() {
        if (closed || active != null) return;
        if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED) {
            events.event("permission",""); return;
        }
        Session s = new Session(); active=s; events.event("connecting","");
        deadline(s,10000);
        try {
            s.bound=context.bindService(new Intent(ACTION).setClassName(APP,APP+".KeyboardSttService"),s,Context.BIND_AUTO_CREATE);
            if (!s.bound) finish(s,"app_missing","",false);
        } catch (SecurityException e) { finish(s,"error","ipc_denied",false); }
        catch (RuntimeException e) { finish(s,"app_missing","",false); }
    }
    private void receive(Session s, Message m) {
        if (active!=s) return;
        Bundle b=m.getData();
        if (b.containsKey("request_id") && b.getInt("request_id")!=s.id) return;
        String value=b.getString("value","");
        if (m.what==STATUS && "connecting".equals(s.state)) {
            if (!"ready".equals(value)) { finish(s,"model_missing","",false); return; }
            s.state="starting"; events.event("starting",""); deadline(s,10000);
            try { io.execute(() -> capture(s)); }
            catch (RejectedExecutionException e) { finish(s,"error","busy",true); }
        } else if (m.what==RESULT && "transcribing".equals(s.state)) finish(s,"result",value,false);
        else if (m.what==ERROR) finish(s,"model_missing".equals(value)?"model_missing":"error",value,false);
    }
    @SuppressLint("MissingPermission")
    private void capture(Session s) {
        AudioRecord rec=null; NoiseSuppressor ns=null; byte[] result=null; String error=null;
        try {
            if (s.cancelled.get()) return;
            int min=AudioRecord.getMinBufferSize(RATE,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT);
            if (min<=0) throw new IllegalStateException("audio_unavailable");
            rec=new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION,RATE,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,Math.max(min*2,8192));
            if (rec.getState()!=AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("audio_unavailable");
            try { if (NoiseSuppressor.isAvailable()) ns=NoiseSuppressor.create(rec.getAudioSessionId()); if(ns!=null) ns.setEnabled(true); } catch(RuntimeException ignored) {}
            if (s.cancelled.get()) return;
            rec.startRecording();
            if (rec.getRecordingState()!=AudioRecord.RECORDSTATE_RECORDING) throw new IllegalStateException("microphone_failed");
            main.post(() -> { if(active==s && !s.stop.get()) { s.state="recording"; events.event("recording",""); deadline(s,65000); } });
            ByteArrayOutputStream pcm=new ByteArrayOutputStream(32768);
            byte[] chunk=new byte[4096]; long end=SystemClock.elapsedRealtime()+60000;
            while(!s.stop.get() && !s.cancelled.get() && pcm.size()<MAX_BYTES && SystemClock.elapsedRealtime()<end) {
                int n=rec.read(chunk,0,Math.min(chunk.length,MAX_BYTES-pcm.size()),AudioRecord.READ_NON_BLOCKING);
                if(n<0) throw new IllegalStateException("audio_read_failed");
                if(n==0) { Thread.sleep(10); continue; }
                pcm.write(chunk,0,n);
            }
            if(!s.cancelled.get()) result=pcm.toByteArray();
        } catch(Exception e) { error=e instanceof SecurityException?"permission":"microphone_failed"; Log.w("KeyboardSTT","Capture failed",e); }
        finally {
            if(rec!=null) { try { rec.stop(); } catch(RuntimeException ignored) {} }
            if(ns!=null) try { ns.release(); } catch(RuntimeException ignored) {}
            if(rec!=null) try { rec.release(); } catch(RuntimeException ignored) {}
        }
        final byte[] audio=result; final String failure=error;
        main.post(() -> {
            if(active!=s) return;
            if(failure!=null) { finish(s,"permission".equals(failure)?"permission":"error",failure,true); return; }
            if(audio==null || audio.length<RATE) { finish(s,"error","no_speech",true); return; }
            s.state="transcribing"; events.event("transcribing",""); deadline(s,180000); sendAudio(s,audio);
        });
    }
    public void stop() {
        Session s=active;
        if(s==null || !"recording".equals(s.state)) return;
        s.stop.set(true); s.state="transcribing"; events.event("transcribing",""); deadline(s,180000);
    }
    public void cancel() { if(active!=null) finish(active,"cancelled","",true); }
    public void close() { closed=true; cancel(); io.shutdown(); }
    private void deadline(Session s,long ms) { main.removeCallbacks(s.timeout); main.postDelayed(s.timeout,ms); }
    private boolean send(Session s,int what,Bundle data) {
        if(s.remote==null) return false;
        try { Message m=Message.obtain(null,what); if(data==null) data=new Bundle(); data.putInt("request_id",s.id); m.setData(data); m.replyTo=s.incoming; s.remote.send(m); return true; }
        catch(RemoteException | RuntimeException e) { return false; }
    }
    private void sendAudio(Session s,byte[] audio) {
        ParcelFileDescriptor[] pipe=null;
        try {
            pipe=ParcelFileDescriptor.createPipe();
            Bundle b=new Bundle(); b.putParcelable("pcm_pipe",pipe[0]);
            if(!send(s,TRANSCRIBE,b)) throw new IllegalStateException("ipc_failed");
            pipe[0].close();
            final ParcelFileDescriptor writer=pipe[1];
            io.execute(() -> writeAudio(s,writer,audio));
        } catch(Exception e) { if(pipe!=null) for(ParcelFileDescriptor p:pipe) try { p.close(); } catch(Exception ignored) {} finish(s,"error","ipc_failed",true); }
    }
    private void writeAudio(Session s,ParcelFileDescriptor writer,byte[] audio) {
        try(ParcelFileDescriptor p=writer) {
            java.io.FileDescriptor fd=p.getFileDescriptor();
            Os.fcntlInt(fd,OsConstants.F_SETFL,Os.fcntlInt(fd,OsConstants.F_GETFL,0)|OsConstants.O_NONBLOCK);
            StructPollfd poll=new StructPollfd(); poll.fd=fd; poll.events=(short)OsConstants.POLLOUT;
            long end=SystemClock.elapsedRealtime()+20000; int off=0;
            while(off<audio.length && !s.cancelled.get()) {
                if(SystemClock.elapsedRealtime()>=end) throw new IllegalStateException("pipe_timeout");
                if(Os.poll(new StructPollfd[]{poll},200)==0) continue;
                try { off+=Os.write(fd,audio,off,Math.min(4096,audio.length-off)); }
                catch(ErrnoException e) { if(e.errno!=OsConstants.EAGAIN && e.errno!=OsConstants.EINTR) throw e; }
            }
        } catch(Exception e) { main.post(() -> { if(active==s) finish(s,"error","ipc_failed",true); }); }
    }
    private void finish(Session s,String state,String text,boolean notifyRemote) {
        if(active!=s) return;
        active=null; s.cancelled.set(true); s.stop.set(true); main.removeCallbacks(s.timeout);
        if(notifyRemote) send(s,CANCEL,null);
        if(s.bound) { try { context.unbindService(s); } catch(RuntimeException ignored) {} s.bound=false; }
        s.remote=null; events.event(state,text);
    }
}
