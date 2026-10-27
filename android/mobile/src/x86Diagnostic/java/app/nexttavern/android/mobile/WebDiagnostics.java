package app.nexttavern.android.mobile;

import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Controlled synthetic x86 QA only. No raw console channel or retained auth context. */
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
    private static final String AUTH_UNAVAILABLE = "\"[AUTH_CONTEXT_UNAVAILABLE]\"";
    private static final Pattern AUTH_HEADER = Pattern.compile(
        "(?:authorization|proxy-authorization|cookie|set-cookie)[\"']?\\s*[:=][^\\r\\n]*", Pattern.CASE_INSENSITIVE);
    private static final Pattern BEARER = Pattern.compile("\\bBearer\\s+[A-Za-z0-9._~+/=-]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern SECRET_ASSIGNMENT = Pattern.compile(
        "(?:api[_ -]?key|(?:access[_ -]?|refresh[_ -]?)?token|password|secret|credential)[\"']?\\s*[=:]\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s,;]+)",
        Pattern.CASE_INSENSITIVE);
    private static final Pattern URL = Pattern.compile(
        "\\b(?:[A-Za-z][A-Za-z0-9+.-]*://|(?:blob|data):)[^\\s\"'<>]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern ENCODED_URL = Pattern.compile(
        "\\b[A-Za-z][A-Za-z0-9+.-]*%3a%2f%2f[^\\s\"'<>]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern QUERY_FRAGMENT = Pattern.compile("[?#][^\\s\"'<>]*");
    private static final Pattern JWT = Pattern.compile("\\beyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+");
    private static final Pattern OPAQUE = Pattern.compile("[A-Za-z0-9_+/=-]{48,}");
    private static final Pattern ANSI = Pattern.compile("\\u001b\\[[0-?]*[ -/]*[@-~]");

    static void observe(ConsoleMessage message, boolean trustedSource, String currentReadyUrl) {
        if (message.messageLevel() != ConsoleMessage.MessageLevel.ERROR) return;
        String text = message.message() == null ? "" : message.message();
        Matcher error = ERROR_CLASS.matcher(text);
        Matcher react = REACT_CODE.matcher(text);
        String errorClass = error.find() ? error.group(1) : "Unknown";
        String reactCode = react.find() ? react.group(1) : "none";
        Log.e(TAG, "event=console-error errorClass=" + errorClass + " reactCode=" + reactCode
            + " " + reason(text, errorClass, reactCode)
            + " bundle=" + publicBundle(message.sourceId(), trustedSource)
            + " line=" + message.lineNumber() + " trustedSource=" + trustedSource
            + " description=" + description(text, message.sourceId(), trustedSource, currentReadyUrl));
    }

    private static String description(String text, String source, boolean trusted, String readyUrl) {
        if (!trusted || readyUrl == null) return AUTH_UNAVAILABLE;
        try {
            URI ready = authUri(readyUrl);
            URI script = new URI(source);
            if (!ready.getScheme().equals(script.getScheme())
                || !ready.getRawAuthority().equals(script.getRawAuthority())) return AUTH_UNAVAILABLE;
            List<String> secrets = startupSecrets(ready);
            // Read current origin cookies only here, in the x86 callback. Never retain the header/URL.
            String cookies = CookieManager.getInstance().getCookie("http://" + ready.getRawAuthority() + "/");
            return redactDescription(text, secrets, cookies);
        } catch (URISyntaxException | UnsupportedEncodingException | RuntimeException ignored) {
            return AUTH_UNAVAILABLE;
        }
    }

    private static URI authUri(String readyUrl) throws URISyntaxException {
        if (readyUrl == null) throw new IllegalArgumentException();
        URI ready = new URI(readyUrl);
        if (!"http".equals(ready.getScheme()) || !"127.0.0.1".equals(ready.getHost())
            || ready.getPort() < 1 || ready.getPort() > 65535 || ready.getUserInfo() != null
            || !ready.getRawAuthority().equals("127.0.0.1:" + ready.getPort())) throw new IllegalArgumentException();
        return ready;
    }

    private static List<String> startupSecrets(URI ready) throws UnsupportedEncodingException {
        List<String> secrets = new ArrayList<>();
        String query = ready.getRawQuery();
        if (query != null) for (String field : query.split("&")) {
            int equals = field.indexOf('=');
            if (equals < 0 || !"token".equals(URLDecoder.decode(field.substring(0, equals), "UTF-8"))) continue;
            String raw = field.substring(equals + 1);
            String decoded = URLDecoder.decode(raw, "UTF-8");
            if (!raw.isEmpty() && !decoded.isEmpty()) { addSecret(secrets, raw); addSecret(secrets, decoded); }
        }
        if (secrets.isEmpty()) throw new IllegalArgumentException();
        addSecret(secrets, "local-test-only");
        return secrets;
    }

    /** Pure fixture seam: same redactor, with auth values supplied only in memory. */
    static String sanitizeDescription(String text, String readyUrl, String cookieHeader) {
        try { return redactDescription(text, startupSecrets(authUri(readyUrl)), cookieHeader); }
        catch (URISyntaxException | UnsupportedEncodingException | IllegalArgumentException ignored) { return AUTH_UNAVAILABLE; }
    }

    private static String redactDescription(String text, List<String> secrets, String cookieHeader) {
        if (cookieHeader != null) for (String cookie : cookieHeader.split(";")) {
            int equals = cookie.indexOf('=');
            if (equals < 0) continue;
            String value = cookie.substring(equals + 1).trim();
            addSecret(secrets, value);
            if (value.length() > 1 && value.startsWith("\"") && value.endsWith("\"")) addSecret(secrets, value.substring(1, value.length() - 1));
        }
        secrets.sort((left, right) -> Integer.compare(right.length(), left.length()));
        String safe = text == null ? "" : text;
        // Exact actual credentials first, before structural filtering or truncation can split one.
        StringBuilder exact = new StringBuilder();
        for (String secret : secrets) {
            if (exact.length() > 0) exact.append('|');
            exact.append(Pattern.quote(secret));
        }
        safe = Pattern.compile(exact.toString()).matcher(safe).replaceAll("[SECRET_REDACTED]");
        safe = safe.replace("\\/", "/");
        safe = ANSI.matcher(safe).replaceAll("");
        safe = AUTH_HEADER.matcher(safe).replaceAll("[AUTH_HEADER_REDACTED]");
        safe = BEARER.matcher(safe).replaceAll("Bearer [REDACTED]");
        safe = SECRET_ASSIGNMENT.matcher(safe).replaceAll("[SECRET_REDACTED]");
        safe = URL.matcher(safe).replaceAll("[URL_REDACTED]");
        safe = ENCODED_URL.matcher(safe).replaceAll("[URL_REDACTED]");
        safe = QUERY_FRAGMENT.matcher(safe).replaceAll("[QUERY_OR_FRAGMENT_REDACTED]");
        safe = JWT.matcher(safe).replaceAll("[JWT_REDACTED]");
        safe = OPAQUE.matcher(safe).replaceAll("[OPAQUE_REDACTED]");
        StringBuilder quoted = new StringBuilder("\"");
        for (int index = 0; index < safe.length(); index++) {
            char character = safe.charAt(index);
            String piece;
            switch (character) {
                case '\n': piece = "\\n"; break;
                case '\r': piece = "\\r"; break;
                case '\t': piece = "\\t"; break;
                case '\\': piece = "\\\\"; break;
                case '\"': piece = "\\\""; break;
                default: piece = Character.isISOControl(character) || character == '\u2028' || character == '\u2029'
                    ? " " : String.valueOf(character);
            }
            if (quoted.length() + piece.length() + 15 > 1000) { quoted.append("...[truncated]"); break; }
            quoted.append(piece);
        }
        return quoted.append('\"').toString();
    }

    private static void addSecret(List<String> secrets, String value) {
        if (value.isEmpty()) return;
        secrets.add(value);
        secrets.add(value.replace("\\", "\\\\").replace("\"", "\\\"").replace("/", "\\/"));
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
