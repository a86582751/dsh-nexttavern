package app.nexttavern.android.mobile;

import android.webkit.ConsoleMessage;

/** Production ARM builds retain no WebView diagnostic logging. */
final class WebDiagnostics {
    static void observe(ConsoleMessage message, boolean trustedSource) {}
    static void pageStarted(boolean trustedOrigin) {}
    static void pageFinished(boolean trustedOrigin) {}
    static void receivedError(int code) {}
    static void receivedHttpError(int status) {}
    static void rendererGone(boolean didCrash, int priority) {}
    private WebDiagnostics() {}
}
