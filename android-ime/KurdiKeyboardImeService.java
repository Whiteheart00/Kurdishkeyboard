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
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

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
    private WebView webView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private int keyboardHeightDp = 390;

    @Override
    public boolean onEvaluateFullscreenMode() {
        return false;
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    public View onCreateInputView() {
        FrameLayout container = new FrameLayout(this);
        container.setBackgroundColor(Color.BLACK);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setLongClickable(false);
        webView.setHapticFeedbackEnabled(false);
        webView.setOnLongClickListener(v -> true);

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(false);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setSupportZoom(false);
        ws.setBuiltInZoomControls(false);
        ws.setDisplayZoomControls(false);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.addJavascriptInterface(new AndroidImeBridge(), "AndroidIME");
        webView.setWebViewClient(new WebViewClient() {
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
        });

        int heightPx = dpToPx(keyboardHeightDp);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                heightPx
        );
        container.addView(webView, lp);
        webView.loadUrl("https://" + VIRTUAL_HOST + "/index.html?ime=1");
        return container;
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
    public void onStartInputView(EditorInfo info, boolean restarting) {
        super.onStartInputView(info, restarting);
        syncLatestSystemClipboard();
        final String currentFieldTail = escapeForJsString(readFastFieldTail());
        mainHandler.post(() -> {
            if (webView != null) {
                webView.evaluateJavascript(
                        "window.__onAndroidImeRefresh && window.__onAndroidImeRefresh('" + currentFieldTail + "');",
                        null
                );
            }
        });
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

    public class AndroidImeBridge {
        @JavascriptInterface
        public void commitText(final String text) {
            if (text == null) return;
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic != null) {
                    ic.commitText(text, 1);
                }
            });
        }

        @JavascriptInterface
        public void deleteBackward() {
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
                        return;
                    }
                }
                ic.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER));
                ic.sendKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_ENTER));
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
                }
            });
        }

        @JavascriptInterface
        public void paste() {
            mainHandler.post(() -> {
                InputConnection ic = getCurrentInputConnection();
                if (ic != null) ic.performContextMenuAction(android.R.id.paste);
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
        public void setKeyboardHeightDp(final int dp) {
            mainHandler.post(() -> {
                if (webView != null && dp >= 210 && dp <= 720 && dp != keyboardHeightDp) {
                    keyboardHeightDp = dp;
                    ViewGroup.LayoutParams lp = webView.getLayoutParams();
                    if (lp != null) {
                        lp.height = dpToPx(dp);
                        webView.setLayoutParams(lp);
                    }
                }
            });
        }
    }
}
