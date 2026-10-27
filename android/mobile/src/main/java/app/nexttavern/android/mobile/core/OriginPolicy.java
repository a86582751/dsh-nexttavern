package app.nexttavern.android.mobile.core;

import java.net.URI;
import java.net.URISyntaxException;

/** Only the current owned process may nominate the WebView's loopback origin. */
public final class OriginPolicy {
    private final String origin;
    private OriginPolicy(String origin) { this.origin = origin; }
    public static OriginPolicy fromReadyUrl(String url) {
        try {
            URI parsed = new URI(url);
            int port = parsed.getPort();
            if (!"http".equals(parsed.getScheme()) || !"127.0.0.1".equals(parsed.getHost())
                || port < 1 || port > 65535 || parsed.getUserInfo() != null
                || !parsed.getRawAuthority().equals("127.0.0.1:" + port)) {
                throw new IllegalArgumentException("READY must nominate an exact IPv4 loopback origin");
            }
            return new OriginPolicy("http://127.0.0.1:" + port);
        } catch (URISyntaxException error) { throw new IllegalArgumentException("Invalid READY URL", error); }
    }
    public boolean contains(String url) {
        try {
            URI parsed = new URI(url);
            return (parsed.getScheme() + "://" + parsed.getRawAuthority()).equals(origin);
        } catch (URISyntaxException error) { return false; }
    }
}
