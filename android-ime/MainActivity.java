package io.kurdikebord.app;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.inputmethod.InputMethodInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.util.List;

/**
 * KurdiKeyboard MainActivity (Capacitor BridgeActivity)
 * Exposes window.AndroidAppSetup so the companion settings app can open Android's
 * system keyboard activation screen and default keyboard picker with 1 tap.
 */
public class MainActivity extends BridgeActivity {
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        attachSetupBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        attachSetupBridge();
        notifyImeStatusToWeb();
    }

    private void attachSetupBridge() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                webView.addJavascriptInterface(new AndroidAppSetupBridge(), "AndroidAppSetup");
            }
        } catch (Exception ignored) {
        }
    }

    private void notifyImeStatusToWeb() {
        mainHandler.postDelayed(() -> {
            try {
                if (this.bridge != null && this.bridge.getWebView() != null) {
                    this.bridge.getWebView().evaluateJavascript(
                            "window.__onAndroidImeStatusChanged && window.__onAndroidImeStatusChanged();",
                            null
                    );
                }
            } catch (Exception ignored) {
            }
        }, 250);
    }

    private boolean checkImeEnabled() {
        try {
            InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (imm == null) return false;
            List<InputMethodInfo> list = imm.getEnabledInputMethodList();
            String pkg = getPackageName();
            for (InputMethodInfo info : list) {
                if (pkg.equals(info.getPackageName())) {
                    return true;
                }
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    private boolean checkImeSelected() {
        try {
            String current = Settings.Secure.getString(
                    getContentResolver(),
                    Settings.Secure.DEFAULT_INPUT_METHOD
            );
            return current != null && current.startsWith(getPackageName() + "/");
        } catch (Exception ignored) {
            return false;
        }
    }

    public class AndroidAppSetupBridge {
        @JavascriptInterface
        public boolean isImeEnabled() {
            return checkImeEnabled();
        }

        @JavascriptInterface
        public boolean isImeSelected() {
            return checkImeSelected();
        }

        @JavascriptInterface
        public void openImeSettings() {
            mainHandler.post(() -> {
                try {
                    Intent intent = new Intent(Settings.ACTION_INPUT_METHOD_SETTINGS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public void openImePicker() {
            mainHandler.post(() -> {
                try {
                    InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm != null) {
                        imm.showInputMethodPicker();
                    }
                } catch (Exception ignored) {
                }
            });
        }
    }
}
