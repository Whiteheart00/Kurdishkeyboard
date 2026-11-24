# Kurdish offline voice IPC / IME stability patch

Vekol stays in Manga Translator (`com.mangatranslator.app`); the keyboard (`io.kurdikebord.app`) captures PCM16 mono 16 kHz and sends it through a bounded local pipe. Install the updated Manga APK and updated keyboard APK together using the existing signing configuration. No model is bundled in the keyboard. The original layouts, themes, AI API configuration and non-Kurdish voice route are retained.

## Changes
- A session-specific Messenger and request ID isolate callbacks. The IME waits for model availability before microphone capture; explicit connecting/starting/recording/transcribing states, cancellation, disconnect and timeout handling.
- Capture and pipe writes are off the UI thread with a bounded worker, a 60-second / 1,920,000-byte audio cap and a 20-second pipe deadline; binding/readiness deadline 10 seconds and recognition deadline 180 seconds. The UI can cancel while connecting or recognizing.
- Dedicated microphone permission activity; after granting, return to the editor and tap the microphone again. No automatic recording when granting permission.
- Native insertion only if the same editor connection is still active and the IME is visible. Voice is disabled in password fields. Hide, editor switch and renderer loss cancel the session. Native result insertion is not repeated in React.
- Editor mutation callbacks are scoped to the current editor generation, supplementary Unicode deletion uses code points, partially completed batch edits are not replayed, WebView diagnostics run on a bounded background queue, old WebViews are released, and renderer recovery is throttled with a manual retry button.

## Validation performed here
Java source syntax parsing (four native files), TSX syntax transpilation, JavaScript generator syntax check and manifest-injection fixture passed. These are not Android compilation, instrumentation or performance benchmarks. No Android SDK, Gradle Android environment or physical device is available here.

## Device acceptance checklist (not yet run)
1. Install both rebuilt APKs over the matching signed versions. Download Vekol in Manga. Select the Kurdish keyboard and Sorani layout.
2. Test first microphone tap without permission, grant permission, return and tap again. Deny permission and verify no audio starts.
3. With airplane mode on, tap mic, wait for recording status, speak, tap stop; verify Kurdish text appears exactly once in the same editor.
4. Remove model / uninstall Manga / force-stop Manga during processing: verify clear error and recovery on next tap. No recording when model is missing.
5. Repeatedly tap mic during connecting, recording and transcribing; cancel; switch fields/apps; hide IME; verify no old text is inserted and mic indicator goes away.
6. Record up to 60 seconds; verify automatic stop and recognition. Try under half a second; verify an error rather than stuck recording.
7. Type rapidly, hold backspace, delete emoji, switch layouts/themes, rotate, reopen repeatedly and test with Manga processing/OCR active. Test low-memory phones; check logcat for ANRs, renderer deaths and native memory usage. Exact throughput and RAM savings need device measurements.
8. Test other voice languages and original keyboard features. Verify a password field cannot start offline voice. Test renderer loss/recovery on an instrumented device.
