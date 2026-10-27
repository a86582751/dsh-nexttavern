package app.nexttavern.android.mobile;

import android.util.Log;
import android.webkit.ConsoleMessage;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** x86 QA metadata only. Never log console text, stack traces, URLs or form values. */
final class WebDiagnostics {
    private static final String TAG = "NextTavernWeb";
    private static final Pattern ERROR_CLASS = Pattern.compile(
        "^(?:Uncaught(?: \\(in promise\\))? )?(AggregateError|EvalError|RangeError|ReferenceError|SyntaxError|TypeError|URIError|Error)(?=\\s*:|$)");
    private static final Pattern REACT_CODE = Pattern.compile("\\bMinified React error #([0-9]{1,4})(?:;|\\b)");
    private static final Pattern READ_PROPERTY = Pattern.compile(
        "\\bCannot read properties of (undefined|null) \\(reading ['\"]([A-Za-z_$][A-Za-z0-9_$]{0,23})['\"]\\)");
    private static final Pattern DESTRUCTURE = Pattern.compile(
        "\\bCannot destructure property ['\"]([A-Za-z_$][A-Za-z0-9_$]{0,23})['\"] of [^\\r\\n]{0,120}? as it is (undefined|null)\\b");
    private static final Pattern NOT_FUNCTION = Pattern.compile(
        "\\b([A-Za-z_$][A-Za-z0-9_$]{0,23}) is not a function\\b");
    private static final Pattern NOT_DEFINED = Pattern.compile(
        "\\b([A-Za-z_$][A-Za-z0-9_$]{0,23}) is not defined\\b");
    // Shape checks cannot prove that an arbitrary property name is not a user-supplied value.
    private static final Pattern PUBLIC_IDENTIFIER = Pattern.compile(
        "(?:map|filter|find|reduce|length|current|value|type|id|call|apply|bind|then|catch|finally|includes|replace|trim|split|join|push|forEach|entries|keys|values)");

    static void observe(ConsoleMessage message, boolean trustedSource) {
        if (message.messageLevel() != ConsoleMessage.MessageLevel.ERROR) return;
        String text = message.message() == null ? "" : message.message();
        Matcher error = ERROR_CLASS.matcher(text);
        Matcher react = REACT_CODE.matcher(text);
        String errorClass = error.find() ? error.group(1) : "Unknown";
        String reactCode = react.find() ? react.group(1) : "none";
        Log.e(TAG, "event=console-error errorClass=" + errorClass + " reactCode=" + reactCode
            + " " + reason(text, errorClass, reactCode)
            + " bundle=" + publicBundle(message.sourceId(), trustedSource)
            + " line=" + message.lineNumber() + " trustedSource=" + trustedSource);
    }

    private static String reason(String text, String errorClass, String reactCode) {
        if (!"none".equals(reactCode)) return "reason=react-minified identifier=omitted";
        if (text.contains("Maximum update depth exceeded") || text.contains("Too many re-renders")) {
            return "reason=maximum-update-depth identifier=omitted";
        }
        Matcher read = READ_PROPERTY.matcher(text);
        if ("TypeError".equals(errorClass) && read.find()) {
            return "reason=read-" + read.group(1) + " identifier=" + identifier(read.group(2));
        }
        Matcher destructure = DESTRUCTURE.matcher(text);
        if ("TypeError".equals(errorClass) && destructure.find()) {
            return "reason=destructure-" + destructure.group(2) + " identifier=" + identifier(destructure.group(1));
        }
        Matcher function = NOT_FUNCTION.matcher(text);
        if ("TypeError".equals(errorClass) && function.find()) {
            return "reason=not-a-function identifier=" + identifier(function.group(1));
        }
        Matcher reference = NOT_DEFINED.matcher(text);
        if ("ReferenceError".equals(errorClass) && reference.find()) {
            return "reason=reference-not-defined identifier=" + identifier(reference.group(1));
        }
        if ("SyntaxError".equals(errorClass)) return "reason=syntax identifier=omitted";
        if (text.contains("Failed to fetch") || text.contains("NetworkError") || text.contains("net::ERR_")) {
            return "reason=network identifier=omitted";
        }
        return "reason=unclassified identifier=omitted";
    }

    private static String identifier(String value) {
        return PUBLIC_IDENTIFIER.matcher(value).matches() ? value : "omitted";
    }

    private static String publicBundle(String source, boolean trusted) {
        if (!trusted || source == null) return "unknown";
        try {
            String path = new URI(source).getPath();
            if ("/assets/index-Q6zc2uHV.js".equals(path)) return "index-Q6zc2uHV.js";
            if ("/assets/vendor-CCJJTK99.js".equals(path)) return "vendor-CCJJTK99.js";
            if (path != null && path.startsWith("/plugins/") && path.endsWith("/client.js")) return "client.js";
        } catch (URISyntaxException ignored) { /* No raw source or parser error may escape to logs. */ }
        return "unknown";
    }

    static void pageStarted(boolean trustedOrigin) {
        Log.i(TAG, "event=page-started trustedOrigin=" + trustedOrigin);
    }
    static void pageFinished(boolean trustedOrigin) {
        Log.i(TAG, "event=page-finished trustedOrigin=" + trustedOrigin);
    }
    static void receivedError(int code) { Log.e(TAG, "event=main-frame-error code=" + code); }
    static void receivedHttpError(int status) { Log.e(TAG, "event=main-frame-http-error status=" + status); }
    static void rendererGone(boolean didCrash, int priority) {
        Log.e(TAG, "event=renderer-gone didCrash=" + didCrash + " priority=" + priority);
    }
    private WebDiagnostics() {}
}
