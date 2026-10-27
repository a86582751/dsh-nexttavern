package app.nexttavern.android.mobile;

import app.nexttavern.android.mobile.core.OriginPolicy;
import java.io.Closeable;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONException;
import org.json.JSONObject;

/** Owns one generation and its pipes; raw host output is never logged or exposed to UI. */
final class NodeSession {
    interface Events {
        void ready(NodeSession owner, String url, String hostVersion, OriginPolicy origin);
        void error(NodeSession owner, String code);
        void stopped(NodeSession owner);
        void exited(NodeSession owner, int exit);
    }
    final String generation;
    private final Process process;
    private final Events events;
    private final File diagnosticStderr;
    private final AtomicBoolean stopping = new AtomicBoolean();
    private boolean ready;
    private final AtomicBoolean errorReported = new AtomicBoolean();

    NodeSession(File nativeDirectory, File code, File home, File workspace, File memory, File tmp,
        String generation, Events events, File diagnosticStderr) throws IOException {
        this.generation = generation;
        this.events = events;
        this.diagnosticStderr = diagnosticStderr;
        File runtime = new File(nativeDirectory, "libnexttavern_node.so");
        if (!runtime.isFile() || !runtime.canExecute()) throw new IOException("NATIVE_RUNTIME_MISSING");
        ProcessBuilder builder = new ProcessBuilder(Arrays.asList(runtime.getAbsolutePath(),
            new File(code, "host-launch.mjs").getAbsolutePath())).directory(workspace).redirectErrorStream(false);
        builder.environment().remove("NODE_OPTIONS");
        builder.environment().remove("NODE_PATH");
        builder.environment().put("HOME", home.getAbsolutePath());
        builder.environment().put("DSH_HOME", home.getAbsolutePath());
        builder.environment().put("NEXTTAVERN_MEMORY_HOME", memory.getAbsolutePath());
        builder.environment().put("TMPDIR", tmp.getAbsolutePath());
        // This Node build defaults to OpenSSL's CA store, whose compiled paths
        // belong to Termux. The bundled public CA set relocates it into this APK.
        builder.environment().put("SSL_CERT_FILE", new File(code, "certs/ca-certificates.pem").getAbsolutePath());
        builder.environment().put("SSL_CERT_DIR", new File(code, "certs").getAbsolutePath());
        builder.environment().put("OPENSSL_CONF", "");
        builder.environment().put("LD_LIBRARY_PATH", nativeDirectory.getAbsolutePath());
        builder.environment().put("NEXTTAVERN_NATIVE_LIBRARY_DIR", nativeDirectory.getAbsolutePath());
        builder.environment().put("NEXTTAVERN_FLOCK_ADDON", new File(nativeDirectory, "libnexttavern_flock.so").getAbsolutePath());
        builder.environment().put("NEXTTAVERN_GENERATION", generation);
        process = builder.start();
    }
    void observe() {
        daemon("mobile-node-stdout", () -> drain(process.getInputStream(), true));
        daemon("mobile-node-stderr", () -> drain(process.getErrorStream(), false));
        daemon("mobile-node-exit", () -> {
            try { events.exited(this, process.waitFor()); }
            catch (InterruptedException error) { Thread.currentThread().interrupt(); }
            finally {
                close(process.getInputStream()); close(process.getErrorStream()); close(process.getOutputStream());
            }
        });
    }
    void stop() throws IOException {
        if (!stopping.compareAndSet(false, true)) return;
        // The host owns cancellation/drain. No arbitrary lifetime or drain timeout.
        try {
            JSONObject command = new JSONObject();
            command.put("protocol", "nexttavern-mobile-v1");
            command.put("generation", generation);
            command.put("command", "stop");
            OutputStream input = process.getOutputStream();
            input.write((command.toString() + "\n").getBytes(StandardCharsets.UTF_8));
            input.flush();
        } catch (JSONException impossible) { throw new AssertionError(impossible); }
    }
    void terminate() {
        stopping.set(true);
        process.destroy(); // SIGTERM only; no implicit force deadline after a stop ACK.
    }
    void forceDestroy() {
        stopping.set(true);
        process.destroyForcibly(); // Only the UI's separately confirmed force action uses this.
    }
    private void drain(InputStream pipe, boolean protocol) {
        FileOutputStream diagnostic = null;
        int saved = 0;
        if (!protocol && diagnosticStderr != null) {
            try { diagnostic = new FileOutputStream(diagnosticStderr, false); }
            catch (IOException unavailable) { /* Diagnostic capture must not control Host behavior. */ }
        }
        try (Reader reader = new InputStreamReader(pipe, StandardCharsets.UTF_8)) {
            char[] buffer = new char[2048];
            StringBuilder line = new StringBuilder();
            boolean oversized = false;
            int count;
            while ((count = reader.read(buffer)) != -1) {
                if (diagnostic != null && saved < 131072) {
                    byte[] bytes = new String(buffer, 0, count).getBytes(StandardCharsets.UTF_8);
                    int length = Math.min(bytes.length, 131072 - saved);
                    try { diagnostic.write(bytes, 0, length); saved += length; }
                    catch (IOException unavailable) { close(diagnostic); diagnostic = null; }
                }
                for (int index = 0; index < count; index++) {
                    char ch = buffer[index];
                    if (ch == '\n') {
                        if (protocol && !oversized) record(line.toString());
                        // Oversized ordinary Host diagnostics are discarded, never retained.
                        line.setLength(0); oversized = false;
                    } else if (line.length() < 65536) line.append(ch);
                    else oversized = true;
                }
            }
            if (protocol && line.length() > 0 && !oversized) record(line.toString());
        } catch (IOException error) { if (!stopping.get()) fail("PIPE_READ_FAILED"); }
        finally { if (diagnostic != null) close(diagnostic); }
    }
    private void record(String line) {
        if (!line.trim().startsWith("{")) return;
        JSONObject value;
        try { value = new JSONObject(line); }
        catch (JSONException diagnostic) { return; } // Ordinary stdout is not a control record.
        if (!"nexttavern-mobile-v1".equals(value.opt("protocol"))
            || !generation.equals(value.opt("generation"))) return;
        try {
            String event = value.getString("event");
            if ("READY".equals(event)) {
                if (ready) throw new IllegalArgumentException("Duplicate readiness");
                String url = value.getString("url");
                OriginPolicy origin = OriginPolicy.fromReadyUrl(url);
                ready = true;
                events.ready(this, url, value.getString("hostVersion"), origin);
            } else if ("STOPPED".equals(event) && stopping.get()) {
                events.stopped(this);
            } else if ("ERROR".equals(event)) {
                String code = value.getString("code");
                fail(code.matches("[A-Z0-9_]{1,64}") ? code : "HOST_ERROR");
            }
        } catch (JSONException | IllegalArgumentException error) { fail("INVALID_PROTOCOL"); }
    }
    private void fail(String code) { if (errorReported.compareAndSet(false, true)) events.error(this, code); }
    private static void daemon(String name, Runnable task) {
        Thread thread = new Thread(task, name); thread.setDaemon(true); thread.start();
    }
    private static void close(Closeable stream) { try { stream.close(); } catch (IOException ignored) { } }
}
