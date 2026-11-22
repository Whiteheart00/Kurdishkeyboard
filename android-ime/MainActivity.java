package io.kurdikebord.app;

import android.app.Dialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.util.List;

/**
 * KurdiKeyboard MainActivity (Capacitor BridgeActivity)
 * Exposes window.AndroidAppSetup so the companion settings app can:
 * 1. Open Android's system keyboard activation screen and default keyboard picker with 1 tap.
 * 2. Launch a 100% native Android EditText testing screen while pausing the background settings
 *    WebView so KurdiKeyboard IME runs with zero dual-WebView contention (WhatsApp-level speed).
 */
public class MainActivity extends BridgeActivity {
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Dialog activeTestDialog = null;

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

    @Override
    public void onDestroy() {
        if (activeTestDialog != null && activeTestDialog.isShowing()) {
            try {
                activeTestDialog.dismiss();
            } catch (Exception ignored) {
            }
        }
        activeTestDialog = null;
        super.onDestroy();
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

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                value,
                getResources().getDisplayMetrics()
        ));
    }

    private GradientDrawable roundedBg(int fillColor, int strokeColor, int radiusDp) {
        GradientDrawable gd = new GradientDrawable();
        gd.setColor(fillColor);
        gd.setCornerRadius(dp(radiusDp));
        if (strokeColor != 0) {
            gd.setStroke(dp(1), strokeColor);
        }
        return gd;
    }

    private Button makeActionButton(String label, int bgColor, int textColor, int strokeColor) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setAllCaps(false);
        btn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12.5f);
        btn.setTypeface(Typeface.DEFAULT_BOLD);
        btn.setTextColor(textColor);
        btn.setBackground(roundedBg(bgColor, strokeColor, 12));
        btn.setPadding(dp(14), dp(8), dp(14), dp(8));
        btn.setMinHeight(dp(40));
        btn.setMinimumHeight(dp(40));
        return btn;
    }

    private void showNativeTestDialog(final String initialText, final boolean isLightTheme) {
        try {
            if (activeTestDialog != null && activeTestDialog.isShowing()) {
                return;
            }

            final WebView settingsWebView = (this.bridge != null) ? this.bridge.getWebView() : null;
            if (settingsWebView != null) {
                // Suspend WebView #1 rendering/timers so KurdiKeyboard IME gets 100% GPU & main thread
                settingsWebView.onPause();
                settingsWebView.setVisibility(View.INVISIBLE);
            }

            final Dialog dialog = new Dialog(this, android.R.style.Theme_DeviceDefault_NoActionBar);
            activeTestDialog = dialog;

            Window win = dialog.getWindow();
            if (win != null) {
                win.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
                win.setSoftInputMode(
                        WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
                                | WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE
                );
                win.setStatusBarColor(isLightTheme ? Color.parseColor("#FFFFFF") : Color.parseColor("#000000"));
            }

            int bgCanvas = isLightTheme ? Color.parseColor("#F1F5F9") : Color.parseColor("#07080B");
            int headerBg = isLightTheme ? Color.parseColor("#FFFFFF") : Color.parseColor("#0D1016");
            int cardBg = isLightTheme ? Color.parseColor("#FFFFFF") : Color.parseColor("#12161E");
            int borderColor = isLightTheme ? Color.parseColor("#CBD5E1") : Color.parseColor("#262D3B");
            int textPrimary = isLightTheme ? Color.parseColor("#0F172A") : Color.parseColor("#F8FAFC");
            int textMuted = isLightTheme ? Color.parseColor("#64748B") : Color.parseColor("#94A3B8");
            int accentBlue = Color.parseColor("#0B5FA8");
            int subtleBtnBg = isLightTheme ? Color.parseColor("#E2E8F0") : Color.parseColor("#1A202C");
            int dangerText = isLightTheme ? Color.parseColor("#DC2626") : Color.parseColor("#FB7185");

            LinearLayout root = new LinearLayout(this);
            root.setOrientation(LinearLayout.VERTICAL);
            root.setBackgroundColor(bgCanvas);
            root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
            root.setLayoutParams(new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
            ));

            // 1. Compact Native Header
            LinearLayout header = new LinearLayout(this);
            header.setOrientation(LinearLayout.HORIZONTAL);
            header.setGravity(Gravity.CENTER_VERTICAL);
            header.setBackgroundColor(headerBg);
            header.setPadding(dp(14), dp(12), dp(14), dp(12));

            TextView titleView = new TextView(this);
            titleView.setText("تاقیکردنەوەی خێرای تەختەکلیل");
            titleView.setTextColor(textPrimary);
            titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15.5f);
            titleView.setTypeface(Typeface.DEFAULT_BOLD);
            LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
                    0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f
            );
            titleView.setLayoutParams(titleLp);
            header.addView(titleView);

            Button switchImeBtn = makeActionButton("گۆڕینی کیبۆرد", accentBlue, Color.WHITE, 0);
            LinearLayout.LayoutParams switchLp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
            );
            switchLp.setMarginEnd(dp(8));
            switchImeBtn.setLayoutParams(switchLp);
            switchImeBtn.setOnClickListener(v -> {
                try {
                    InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm != null) imm.showInputMethodPicker();
                } catch (Exception ignored) {
                }
            });
            header.addView(switchImeBtn);

            Button closeBtn = makeActionButton("داخستن", subtleBtnBg, textPrimary, borderColor);
            closeBtn.setOnClickListener(v -> dialog.dismiss());
            header.addView(closeBtn);

            root.addView(header);

            // 2. Main Native EditText Card
            LinearLayout contentWrap = new LinearLayout(this);
            contentWrap.setOrientation(LinearLayout.VERTICAL);
            contentWrap.setPadding(dp(14), dp(14), dp(14), dp(12));
            LinearLayout.LayoutParams contentLp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f
            );
            contentWrap.setLayoutParams(contentLp);

            LinearLayout editorCard = new LinearLayout(this);
            editorCard.setOrientation(LinearLayout.VERTICAL);
            editorCard.setBackground(roundedBg(cardBg, borderColor, 18));
            editorCard.setPadding(dp(14), dp(12), dp(14), dp(12));
            LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f
            );
            editorCard.setLayoutParams(cardLp);

            final EditText editText = new EditText(this);
            editText.setBackground(null);
            editText.setTextColor(textPrimary);
            editText.setHintTextColor(textMuted);
            editText.setHint("لێرە بە خێرایی تەواو بنووسە بۆ تاقیکردنەوەی تەختەکلیلی کوردی...");
            editText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17.5f);
            editText.setGravity(Gravity.TOP | Gravity.START);
            editText.setTextDirection(View.TEXT_DIRECTION_ANY_RTL);
            editText.setInputType(
                    InputType.TYPE_CLASS_TEXT
                            | InputType.TYPE_TEXT_FLAG_MULTI_LINE
                            | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            );
            editText.setHorizontallyScrolling(false);
            if (initialText != null && !initialText.isEmpty()) {
                editText.setText(initialText);
                editText.setSelection(initialText.length());
            }
            LinearLayout.LayoutParams editLp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f
            );
            editText.setLayoutParams(editLp);
            editorCard.addView(editText);

            // Footer row inside editor card: live stats + Copy + Clear
            LinearLayout footer = new LinearLayout(this);
            footer.setOrientation(LinearLayout.HORIZONTAL);
            footer.setGravity(Gravity.CENTER_VERTICAL);
            footer.setPadding(0, dp(10), 0, 0);

            final TextView statsView = new TextView(this);
            statsView.setTextColor(textMuted);
            statsView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f);
            LinearLayout.LayoutParams statsLp = new LinearLayout.LayoutParams(
                    0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f
            );
            statsView.setLayoutParams(statsLp);
            footer.addView(statsView);

            Runnable updateStats = () -> {
                String txt = editText.getText() != null ? editText.getText().toString() : "";
                String trimmed = txt.trim();
                int words = trimmed.isEmpty() ? 0 : trimmed.split("\\s+").length;
                statsView.setText(txt.length() + " پیت · " + words + " ووشە");
            };
            updateStats.run();

            editText.addTextChangedListener(new TextWatcher() {
                @Override
                public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

                @Override
                public void onTextChanged(CharSequence s, int start, int before, int count) {}

                @Override
                public void afterTextChanged(Editable s) {
                    updateStats.run();
                }
            });

            Button copyBtn = makeActionButton("کۆپی", subtleBtnBg, textPrimary, borderColor);
            LinearLayout.LayoutParams copyLp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
            );
            copyLp.setMarginEnd(dp(8));
            copyBtn.setLayoutParams(copyLp);
            copyBtn.setOnClickListener(v -> {
                try {
                    String txt = editText.getText() != null ? editText.getText().toString() : "";
                    ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    if (cm != null && !txt.isEmpty()) {
                        cm.setPrimaryClip(ClipData.newPlainText("KurdiKeyboard", txt));
                        Toast.makeText(MainActivity.this, "دەقەکە کۆپی کرا", Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception ignored) {
                }
            });
            footer.addView(copyBtn);

            Button clearBtn = makeActionButton("پاککردنەوە", subtleBtnBg, dangerText, borderColor);
            clearBtn.setOnClickListener(v -> editText.setText(""));
            footer.addView(clearBtn);

            editorCard.addView(footer);
            contentWrap.addView(editorCard);
            root.addView(contentWrap);

            dialog.setContentView(root);
            dialog.setOnDismissListener(d -> {
                activeTestDialog = null;
                try {
                    InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm != null) {
                        imm.hideSoftInputFromWindow(editText.getWindowToken(), 0);
                    }
                } catch (Exception ignored) {
                }
                final String finalText = editText.getText() != null ? editText.getText().toString() : "";
                if (settingsWebView != null) {
                    settingsWebView.setVisibility(View.VISIBLE);
                    settingsWebView.onResume();
                    try {
                        String quoted = JSONObject.quote(finalText);
                        settingsWebView.evaluateJavascript(
                                "window.__onNativeTestBoxClosed && window.__onNativeTestBoxClosed(" + quoted + ");",
                                null
                        );
                    } catch (Exception ignored) {
                    }
                }
            });

            dialog.show();

            mainHandler.postDelayed(() -> {
                try {
                    editText.requestFocus();
                    InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm != null) {
                        imm.showSoftInput(editText, InputMethodManager.SHOW_IMPLICIT);
                    }
                } catch (Exception ignored) {
                }
            }, 120);
        } catch (Exception ignored) {
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

        @JavascriptInterface
        public void openNativeTestBox(final String initialText, final boolean isLightTheme) {
            mainHandler.post(() -> showNativeTestDialog(initialText, isLightTheme));
        }
    }
}
