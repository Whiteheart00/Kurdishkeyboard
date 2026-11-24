package io.kurdikebord.app;

import android.annotation.SuppressLint;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.inputmethodservice.InputMethodService;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.ExtractedText;
import android.view.inputmethod.ExtractedTextRequest;
import android.view.inputmethod.InputConnection;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * KurdiKeyboard native Android InputMethodService (Direct Boot Aware).
 * Uses the exact same https://localhost origin as Capacitor's MainActivity so
 * settings, themes, custom shortcuts, and permanent clipboard history are shared seamlessly.
 */
public class KurdiKeyboardImeService extends InputMethodService {
    private static final String VIRTUAL_HOST = "localhost";
    private FrameLayout rootContainer;
    private WebView webView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private int keyboardHeightDp = 390;
    private String lastSyncedTail = null;
    private long lastLocalCommitAt = 0L;
    private OfflineKeyboardStt offlineKeyboardStt;
    private final Runnable syncTailRunnable = () -> {
        if (webView == null) return;
        final String tail = readFastFieldTail();
        if (tail.equals(lastSyncedTail)) return;
        lastSyncedTail = tail;
        final String escaped = escapeForJsString(tail);
        webView.evaluateJavascript(
                "window.__onAndroidEditorTail && window.__onAndroidEditorTail('" + escaped + "');",
                null
        );
    };
    private final Runnable delayedRepaintRunnable = () -> {
        if (webView == null) return;
        try {
            webView.onResume();
            webView.resumeTimers();
            webView.invalidate();
            webView.postInvalidateOnAnimation();
            if (rootContainer != null) {
                rootContainer.invalidate();
            }
            webView.evaluateJavascript(
                    "window.__onAndroidImeForceRepaint && window.__onAndroidImeForceRepaint();",
                    null
            );
        } catch (Exception ignored) {
        }
    };

    private void scheduleSyncEditorTail(long delayMs) {
        mainHandler.removeCallbacks(syncTailRunnable);
        mainHandler.postDelayed(syncTailRunnable, delayMs);
    }

    private void forceWebViewRepaint() {
        mainHandler.post(() -> {
            if (webView == null) return;
            try {
                webView.onResume();
                webView.resumeTimers();
                webView.setVisibility(View.VISIBLE);
                webView.invalidate();
                webView.postInvalidateOnAnimation();
                if (rootContainer != null) {
                    rootContainer.invalidate();
                }
                webView.evaluateJavascript(
                        "window.__onAndroidImeForceRepaint && window.__onAndroidImeForceRepaint();",
                        null
                );
            } catch (Exception ignored) {
            }
        });
        // Second compositor kick after IME slide-in window surface finishes attaching
        mainHandler.removeCallbacks(delayedRepaintRunnable);
        mainHandler.postDelayed(delayedRepaintRunnable, 70);
    }

    @Override
    public boolean onEvaluateFullscreenMode() {
        return false;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private WebView createConfiguredWebView() {
        WebView wv = new WebView(this);
        wv.setBackgroundColor(Color.BLACK);
        wv.setVerticalScrollBarEnabled(false);
        wv.setHorizontalScrollBarEnabled(false);
        wv.setOverScrollMode(View.OVER_SCROLL_NEVER);
        wv.setLongClickable(false);
        wv.setHapticFeedbackEnabled(false);
        wv.setOnLongClickListener(v -> true);

        // Keep IME renderer high priority even while hidden so Android 14–16 does not evict GPU surfaces
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            try {
                wv.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
            } catch (Exception ignored) {
            }
        }

        WebSettings ws = wv.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(false);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setSupportZoom(false);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);

        wv.addJavascriptInterface(new AndroidImeBridge(), "AndroidIME");
        wv.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && VIRTUAL_HOST.equalsIgnoreCase(uri.getHost())) {
                    String path = uri.getPath();
                    if (path == null || path.equals("/") || path.isEmpty()) {
                        path = "/index.html";
                    }
                    String assetPath = "public" + path;
                    try {
                        InputStream is = getAssets().open(assetPath);
                        return buildAssetResponse(guessMimeType(path), is);
                    } catch (IOException e) {
                        try {
                            InputStream fallback = getAssets().open("public/index.html");
                            return buildAssetResponse("text/html", fallback);
                        } catch (IOException ignored) {
                            return null;
                        }
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                super.onReceivedError(view, request, error);
                try {
                    String path = (request != null && request.getUrl() != null) ? request.getUrl().getPath() : "unknown";
                    if (path != null && path.contains("emoji-datasource-facebook")) {
                        return;
                    }
                    CharSequence desc = error != null ? error.getDescription() : "WebView resource error";
                    MainActivity.recordNativeEvent(
                            KurdiKeyboardImeService.this,
                            "ERRORS",
                            "ERROR",
                            "IME WebView Resource Error",
                            "WebView error on " + path + ": " + desc,
                            "KurdiKeyboardImeService",
                            "onReceivedError",
                            "FAILED",
                            null
                    );
                } catch (Exception ignored) {
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                super.onReceivedHttpError(view, request, errorResponse);
                try {
                    String path = (request != null && request.getUrl() != null) ? request.getUrl().getPath() : "unknown";
                    if (path != null && path.contains("emoji-datasource-facebook")) {
                        return;
                    }
                    int status = errorResponse != null ? errorResponse.getStatusCode() : 0;
                    MainActivity.recordNativeEvent(
                            KurdiKeyboardImeService.this,
                            "NETWORK",
                            status >= 500 ? "ERROR" : "WARNING",
                            "IME WebView HTTP " + status,
                            "WebView HTTP error " + status + " for " + path,
                            "KurdiKeyboardImeService",
                            "onReceivedHttpError",
                            "FAILED",
                            null
                    );
                } catch (Exception ignored) {
                }
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                try {
                    boolean crashed = detail != null && detail.didCrash();
                    MainActivity.recordNativeEvent(
                            KurdiKeyboardImeService.this,
                            "CRASHES",
                            "CRITICAL",
                            "IME WebView Render Process Gone",
                            crashed ? "IME WebView renderer crashed unexpectedly." : "IME WebView renderer killed by OS under memory pressure.",
                            "KurdiKeyboardImeService",
                            "onRenderProcessGone",
                            "FAILED",
                            null
                    );
                } catch (Exception ignored) {
                }
                // Self-heal if Android killed the WebView renderer process so the keyboard never stays black
                mainHandler.post(() -> {
                    try {
                        if (rootContainer != null) {
                            rootContainer.removeAllViews();
                            if (webView != null) {
                                try {
                                    webView.destroy();
                                } catch (Exception ignored2) {
                                }
                            }
                            webView = createConfiguredWebView();
                            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                                    ViewGroup.LayoutParams.MATCH_PARENT,
                                    dpToPx(keyboardHeightDp)
                            );
                            rootContainer.addView(webView, lp);
                            webView.loadUrl("https://" + VIRTUAL_HOST + "/index.html?ime=1");
                        }
                    } catch (Exception ignored2) {
                    }
                });
                return true;
            }
        });
        return wv;
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    public View onCreateInputView() {
        rootContainer = new FrameLayout(this);
        rootContainer.setBackgroundColor(Color.BLACK);

        webView = createConfiguredWebView();

        int heightPx = dpToPx(keyboardHeightDp);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                heightPx
        );
        rootContainer.addView(webView, lp);
        webView.loadUrl("https://" + VIRTUAL_HOST + "/index.html?ime=1");
        return rootContainer;
    }

    private WebResourceResponse buildAssetResponse(String mimeType, InputStream stream) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        if ("text/html".equals(mimeType)) {
            headers.put("Cache-Control", "no-cache");
        } else {
            headers.put("Cache-Control", "public, max-age=31536000");
        }
        return new WebResourceResponse(mimeType, "UTF-8", 200, "OK", headers, stream);
    }

    private String readCurrentFieldText(boolean preferSelection) {
        try {
            InputConnection ic = getCurrentInputConnection();
            if (ic == null) return "";
            if (preferSelection) {
                CharSequence selected = ic.getSelectedText(0);
                if (!TextUtils.isEmpty(selected)) {
                    return selected.toString();
                }
            }
            ExtractedText et = ic.getExtractedText(new ExtractedTextRequest(), 0);
            if (et != null && !TextUtils.isEmpty(et.text)) {
                return et.text.toString();
            }
            CharSequence before = ic.getTextBeforeCursor(4000, 0);
            CharSequence after = ic.getTextAfterCursor(4000, 0);
            StringBuilder sb = new StringBuilder();
            if (before != null) sb.append(before);
            if (after != null) sb.append(after);
            return sb.toString();
        } catch (Exception ignored) {
            return "";
        }
    }

    private String escapeForJsString(String raw) {
        if (raw == null) return "";
        return raw
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\n", "\\n")
                .replace("\r", "")
                .replace("\u2028", "\\u2028")
                .replace("\u2029", "\\u2029");
    }

    private String readFastFieldTail() {
        try {
            InputConnection ic = getCurrentInputConnection();
            if (ic == null) return "";
            CharSequence before = ic.getTextBeforeCursor(240, 0);
            return before != null ? before.toString() : "";
        } catch (Exception ignored) {
            return "";
        }
    }

    @Override
    public void onWindowShown() {
        super.onWindowShown();
        forceWebViewRepaint();
    }

    @Override
    public void onStartInputView(EditorInfo info, boolean restarting) {
        super.onStartInputView(info, restarting);
        forceWebViewRepaint();
        syncLatestSystemClipboard();
        final String rawTail = readFastFieldTail();
        lastSyncedTail = rawTail;
        final String currentFieldTail = escapeForJsString(rawTail);
        mainHandler.post(() -> {
            if (webView != null) {
                webView.evaluateJavascript(
                        "window.__onAndroidImeRefresh && window.__onAndroidImeRefresh('" + currentFieldTail + "');",
                        null
                );
            }
        });
    }

    @Override
    public void onUpdateSelection(
            int oldSelStart,
            int oldSelEnd,
            int newSelStart,
            int newSelEnd,
            int candidatesStart,
            int candidatesEnd
    ) {
        super.onUpdateSelection(oldSelStart, oldSelEnd, newSelStart, newSelEnd, candidatesStart, candidatesEnd);
        long now = android.os.SystemClock.uptimeMillis();
        long delay = (now - lastLocalCommitAt < 280L) ? 320L : 85L;
        scheduleSyncEditorTail(delay);
    }

    private void syncLatestSystemClipboard() {
        if (webView == null) return;
        try {
            ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
            if (cm != null && cm.hasPrimaryClip()) {
                ClipData clip = cm.getPrimaryClip();
                if (clip != null && clip.getItemCount() > 0) {
                    CharSequence text = clip.getItemAt(0).coerceToText(this);
                    if (!TextUtils.isEmpty(text)) {
                        String escaped = text.toString()
                                .replace("\\", "\\\\")
                                .replace("'", "\\'")
                                .replace("\n", "\\n")
                                .replace("\r", "");
                        mainHandler.post(() -> {
                            if (webView != null) {
                                webView.evaluateJavascript(
                                        "window.__onAndroidClipboardSync && window.__onAndroidClipboardSync('" + escaped + "');",
                                        null
                                );
                            }
                        });
                    }
                }
            }
        } catch (Exception ignored) {
        }
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }

    private String guessMimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".ttf")) return "font/ttf";
        if (lower.endsWith(".otf")) return "font/otf";
        return "application/octet-stream";
    }

    private void emitKeyboardVoiceEvent(String state, String text) {
        mainHandler.post(() -> {
            if (webView == null) return;
            webView.evaluateJavascript("window.__onKeyboardOfflineVoiceEvent && window.__onKeyboardOfflineVoiceEvent(" +
                    JSONObject.quote(state == null ? "" : state) + "," +
                    JSONObject.quote(text == null ? "" : text) + ");", null);
        });
    }

    public class AndroidImeBridge {
        @JavascriptInterface
        public void startOfflineVoice() {
            mainHandler.post(() -> {
                if (offlineKeyboardStt == null) {
                    offlineKeyboardStt = new OfflineKeyboardStt(KurdiKeyboardImeService.this,
                            (state, text) -> emitKeyboardVoiceEvent(state, text));
                }
                offlineKeyboardStt.start();
            });
        }
        @JavascriptInterface
        public void stopOfflineVoice() {
            mainHandler.post(() -> { if (offlineKeyboardStt != null) offlineKeyboardStt.stop(); });
        }
        @JavascriptInterface
        public void cancelOfflineVoice() {
            mainHandler.post(() -> { if (offlineKeyboardStt != null) offlineKeyboardStt.cancel(); });
        }
        @JavascriptInterface
        public void commitText(final String text) {
            if (text == null) return;
            lastLocalCommitAt = android.os.SystemClock.uptimeMillis();
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic != null) {
                    ic.commitText(text, 1);
                }
            });
        }

        @JavascriptInterface
        public void deleteBackward() {
            lastLocalCommitAt = android.os.SystemClock.uptimeMillis();
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic != null) {
                    CharSequence selected = ic.getSelectedText(0);
                    if (!TextUtils.isEmpty(selected)) {
                        ic.commitText("", 1);
                    } else {
                        ic.deleteSurroundingText(1, 0);
                    }
                }
            });
        }

        @JavascriptInterface
        public void deleteWord() {
            lastLocalCommitAt = android.os.SystemClock.uptimeMillis();
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic == null) return;
                CharSequence before = ic.getTextBeforeCursor(64, 0);
                if (TextUtils.isEmpty(before)) return;
                String s = before.toString();
                int len = s.length();
                int i = len - 1;
                while (i >= 0 && Character.isWhitespace(s.charAt(i))) i--;
                while (i >= 0 && !Character.isWhitespace(s.charAt(i))) i--;
                int count = len - (i + 1);
                if (count > 0) {
                    ic.deleteSurroundingText(count, 0);
                }
            });
        }

        @JavascriptInterface
        public void replaceSurroundingText(final int deleteBefore, final String insertText) {
            lastLocalCommitAt = android.os.SystemClock.uptimeMillis();
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic == null) return;
                try {
                    ic.beginBatchEdit();
                    if (deleteBefore > 0) {
                        ic.deleteSurroundingText(deleteBefore, 0);
                    }
                    if (insertText != null && !insertText.isEmpty()) {
                        ic.commitText(insertText, 1);
                    }
                    ic.endBatchEdit();
                } catch (Exception ignored) {
                    if (deleteBefore > 0) {
                        ic.deleteSurroundingText(deleteBefore, 0);
                    }
                    if (insertText != null && !insertText.isEmpty()) {
                        ic.commitText(insertText, 1);
                    }
                }
                scheduleSyncEditorTail(120);
            });
        }

        @JavascriptInterface
        public void sendEnter() {
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                EditorInfo ei = getCurrentInputEditorInfo();
                if (ic == null) return;
                if (ei != null) {
                    int action = ei.imeOptions & EditorInfo.IME_MASK_ACTION;
                    if (action != EditorInfo.IME_ACTION_NONE
                            && action != EditorInfo.IME_ACTION_UNSPECIFIED
                            && (ei.imeOptions & EditorInfo.IME_FLAG_NO_ENTER_ACTION) == 0) {
                        ic.performEditorAction(action);
                        scheduleSyncEditorTail(120);
                        return;
                    }
                }
                ic.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER));
                ic.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ENTER));
                scheduleSyncEditorTail(120);
            });
        }

        @JavascriptInterface
        public void moveCursor(final int delta) {
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic == null) return;
                int keyCode = delta < 0 ? KeyEvent.KEYCODE_DPAD_LEFT : KeyEvent.KEYCODE_DPAD_RIGHT;
                ic.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, keyCode));
                ic.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, keyCode));
                scheduleSyncEditorTail(120);
            });
        }

        @JavascriptInterface
        public void moveCursorEx(final int dx, final int dy, final boolean select) {
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic == null) return;
                int keyCode;
                if (dy < 0) keyCode = KeyEvent.KEYCODE_DPAD_UP;
                else if (dy > 0) keyCode = KeyEvent.KEYCODE_DPAD_DOWN;
                else if (dx < 0) keyCode = KeyEvent.KEYCODE_DPAD_LEFT;
                else keyCode = KeyEvent.KEYCODE_DPAD_RIGHT;

                long now = android.os.SystemClock.uptimeMillis();
                int meta = select ? KeyEvent.META_SHIFT_ON : 0;
                ic.sendKeyEvent(new KeyEvent(now, now, KeyEvent.ACTION_DOWN, keyCode, 0, meta));
                ic.sendKeyEvent(new KeyEvent(now, now, KeyEvent.ACTION_UP, keyCode, 0, meta));
            });
        }

        @JavascriptInterface
        public void moveLineEdge(final boolean toEnd, final boolean select) {
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic == null) return;
                int keyCode = toEnd ? KeyEvent.KEYCODE_MOVE_END : KeyEvent.KEYCODE_MOVE_HOME;
                long now = android.os.SystemClock.uptimeMillis();
                int meta = select ? KeyEvent.META_SHIFT_ON : 0;
                ic.sendKeyEvent(new KeyEvent(now, now, KeyEvent.ACTION_DOWN, keyCode, 0, meta));
                ic.sendKeyEvent(new KeyEvent(now, now, KeyEvent.ACTION_UP, keyCode, 0, meta));
            });
        }

        @JavascriptInterface
        public void selectAll() {
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic != null) ic.performContextMenuAction(android.R.id.selectAll);
            });
        }

        @JavascriptInterface
        public void copy() {
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic != null) {
                    ic.performContextMenuAction(android.R.id.copy);
                    mainHandler.postDelayed(KurdiKeyboardImeService.this::syncLatestSystemClipboard, 120);
                }
            });
        }

        @JavascriptInterface
        public void cut() {
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic != null) {
                    ic.performContextMenuAction(android.R.id.cut);
                    mainHandler.postDelayed(KurdiKeyboardImeService.this::syncLatestSystemClipboard, 120);
                    scheduleSyncEditorTail(140);
                }
            });
        }

        @JavascriptInterface
        public void paste() {
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic != null) {
                    ic.performContextMenuAction(android.R.id.paste);
                    scheduleSyncEditorTail(140);
                }
            });
        }

        @JavascriptInterface
        public void hideKeyboard() {
            mainHandler.post(() -> requestHideSelf(0));
        }

        @JavascriptInterface
        public void openSettings() {
            mainHandler.post(() -> {
                try {
                    Intent intent = new Intent(KurdiKeyboardImeService.this, MainActivity.class);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public String getEditorText(final boolean preferSelection) {
            if (Looper.myLooper() == Looper.getMainLooper()) {
                return readCurrentFieldText(preferSelection);
            }
            final AtomicReference<String> result = new AtomicReference<>("");
            final CountDownLatch latch = new CountDownLatch(1);
            mainHandler.post(() -> {
                try {
                    result.set(readCurrentFieldText(preferSelection));
                } finally {
                    latch.countDown();
                }
            });
            try {
                latch.await(250, TimeUnit.MILLISECONDS);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
            return result.get();
        }

        @JavascriptInterface
        public void replaceAllText(final String newText, final boolean preferSelection) {
            if (newText == null) return;
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic == null) return;
                try {
                    if (preferSelection) {
                        CharSequence selected = ic.getSelectedText(0);
                        if (!TextUtils.isEmpty(selected)) {
                            ic.commitText(newText, 1);
                            return;
                        }
                    }
                    ic.beginBatchEdit();
                    CharSequence before = ic.getTextBeforeCursor(4000, 0);
                    CharSequence after = ic.getTextAfterCursor(4000, 0);
                    int beforeLen = before != null ? before.length() : 0;
                    int afterLen = after != null ? after.length() : 0;
                    if (beforeLen > 0 || afterLen > 0) {
                        ic.deleteSurroundingText(beforeLen, afterLen);
                    }
                    ic.commitText(newText, 1);
                    ic.endBatchEdit();
                } catch (Exception ignored) {
                    ic.commitText(newText, 1);
                }
            });
        }

        @JavascriptInterface
        public int getScreenHeightDp() {
            try {
                android.util.DisplayMetrics dm = getResources().getDisplayMetrics();
                if (dm != null && dm.density > 0f) {
                    return Math.round(dm.heightPixels / dm.density);
                }
            } catch (Exception ignored) {
            }
            return 840;
        }

        @JavascriptInterface
        public void requestRepaint() {
            mainHandler.post(() -> {
                if (webView == null) return;
                try {
                    webView.onResume();
                    webView.resumeTimers();
                    webView.invalidate();
                    webView.postInvalidateOnAnimation();
                    if (rootContainer != null) {
                        rootContainer.invalidate();
                    }
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public void setKeyboardHeightDp(final int dp) {
            mainHandler.post(() -> {
                if (webView != null && dp >= 210 && dp <= 720 && dp != keyboardHeightDp) {
                    keyboardHeightDp = dp;
                    ViewGroup.LayoutParams lp = webView.getLayoutParams();
                    if (lp != null) {
                        lp.height = dpToPx(dp);
                        webView.setLayoutParams(lp);
                        webView.postInvalidateOnAnimation();
                    }
                }
            });
        }
    }
}
