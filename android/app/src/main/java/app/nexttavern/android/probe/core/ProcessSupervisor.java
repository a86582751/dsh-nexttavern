package app.nexttavern.android.probe.core;

import java.io.Closeable;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/** Foreground-only process supervisor. run() must be called off the Android main thread. */
public final class ProcessSupervisor {
    public enum State { IDLE, RUNNING, CAPABILITIES_PASSED, FAILED, BLOCKED, CANCELLED, TIMED_OUT }
    public interface Listener { void changed(); }
    public interface Parser { Record parse(String line) throws IllegalArgumentException; }
    public interface Launcher { Process start(List<String> command, File cwd) throws IOException; }
    public static final class Record {
        public final String event;
        public final String status;
        public final boolean ok;
        public final String actualPlatform;
        public final String summary;
        public Record(String event, String status, boolean ok, String actualPlatform, String summary) {
            this.event = event;
            this.status = status;
            this.ok = ok;
            this.actualPlatform = actualPlatform;
            this.summary = summary;
        }
    }
    public static final class Snapshot {
        public final State state;
        public final String detail;
        public final boolean ready;
        public final String stdout;
        public final String stderr;
        public final String finalRecord;
        private Snapshot(State state, String detail, boolean ready, String stdout, String stderr, String finalRecord) {
            this.state = state;
            this.detail = detail;
            this.ready = ready;
            this.stdout = stdout;
            this.stderr = stderr;
            this.finalRecord = finalRecord;
        }
    }
    private final Listener listener;
    private final Parser parser;
    private final Launcher launcher;
    private final AtomicBoolean cancelled = new AtomicBoolean();
    private final BoundedLog stdout = new BoundedLog(160, 48000);
    private final BoundedLog stderr = new BoundedLog(100, 24000);
    private Process process;
    private State state = State.IDLE;
    private String detail = "Not started";
    private boolean ready;
    private int resultCount;
    private int protocolErrors;
    private Record result;
    private String finalRecord = "";
    private boolean streamFailure;

    public ProcessSupervisor(Parser parser, Listener listener) {
        this(parser, listener, (command, cwd) -> {
            ProcessBuilder builder = new ProcessBuilder(command).directory(cwd).redirectErrorStream(false);
            // Do not inherit desktop/test Node hooks or arbitrary loader injection.
            builder.environment().remove("NODE_OPTIONS");
            builder.environment().remove("NODE_PATH");
            builder.environment().put("HOME", cwd.getAbsolutePath());
            builder.environment().put("TMPDIR", cwd.getAbsolutePath());
            String nativeDirectory = new File(command.get(0)).getParent();
            builder.environment().put("LD_LIBRARY_PATH", nativeDirectory);
            builder.environment().put("NEXTTAVERN_FLOCK_ADDON",
                new File(nativeDirectory, "libnexttavern_flock.so").getAbsolutePath());
            return builder.start();
        });
    }
    public ProcessSupervisor(Parser parser, Listener listener, Launcher launcher) {
        this.parser = parser;
        this.listener = listener;
        this.launcher = launcher;
    }
    public synchronized Snapshot snapshot() {
        return new Snapshot(state, detail, ready, stdout.text(), stderr.text(), finalRecord);
    }
    private void update(State next, String message) {
        synchronized (this) { state = next; detail = message; }
        listener.changed();
    }
    public void preparing() { update(State.RUNNING, "Preparing private scripts and stable data cwd"); }
    public void blocked(String reason) {
        update(cancelled.get() ? State.CANCELLED : State.BLOCKED, reason);
    }
    public void cancel() {
        cancelled.set(true);
        synchronized (this) { if (process != null) process.destroy(); }
        // run() performs bounded waiting, forceful teardown and pipe cleanup.
    }
    public boolean isCancelled() { return cancelled.get(); }

    public void run(List<String> command, File cwd, long timeoutSeconds) {
        Process child = null;
        Thread outReader = null;
        Thread errReader = null;
        try {
            synchronized (this) {
                if (cancelled.get()) { update(State.CANCELLED, "Cancelled before launch"); return; }
                child = launcher.start(command, cwd);
                process = child;
            }
            close(child.getOutputStream()); // Probe is non-interactive; no inherited stdin.
            update(State.RUNNING, "Waiting for structured readiness and final result");
            Process running = child;
            outReader = new Thread(() -> drain(running.getInputStream(), true), "probe-stdout");
            errReader = new Thread(() -> drain(running.getErrorStream(), false), "probe-stderr");
            outReader.setDaemon(true);
            errReader.setDaemon(true);
            outReader.start();
            errReader.start();
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeoutSeconds);
            boolean timedOut = false;
            while (!child.waitFor(200, TimeUnit.MILLISECONDS)) {
                if (cancelled.get()) break;
                if (System.nanoTime() >= deadline) { timedOut = true; break; }
            }
            if (cancelled.get() || timedOut) stop(child);
            outReader.join(2000);
            errReader.join(2000);
            if (outReader.isAlive() || errReader.isAlive()) {
                close(child.getInputStream());
                close(child.getErrorStream());
                synchronized (this) { streamFailure = true; }
            }
            if (cancelled.get()) update(State.CANCELLED, "Cancelled; native process stopped");
            else if (timedOut) update(State.TIMED_OUT, "Native probe exceeded " + timeoutSeconds + " seconds");
            else complete(child.exitValue());
        } catch (InterruptedException error) {
            cancelled.set(true);
            Thread.currentThread().interrupt();
            update(State.CANCELLED, "Worker interrupted; native process teardown requested");
        } catch (IOException | RuntimeException error) {
            update(cancelled.get() ? State.CANCELLED : State.BLOCKED,
                "Native launch/supervision blocked: " + error.getMessage());
        } finally {
            if (child != null) {
                stop(child);
                close(child.getInputStream());
                close(child.getErrorStream());
                close(child.getOutputStream());
            }
            synchronized (this) { process = null; }
        }
    }

    private void complete(int exit) {
        Record finalResult;
        synchronized (this) {
            if (!ready || resultCount != 1 || protocolErrors != 0 || streamFailure) {
                update(State.FAILED, "Incomplete/invalid protocol: ready=" + ready + ", results=" + resultCount
                    + ", protocolErrors=" + protocolErrors + ", streamFailure=" + streamFailure + ", exit=" + exit);
                return;
            }
            finalResult = result;
        }
        if (exit == 0 && finalResult.ok && "passed".equals(finalResult.status)
            && "android".equals(finalResult.actualPlatform)) {
            update(State.CAPABILITIES_PASSED, "Android capability suite passed; full G0 is NOT accepted. " + finalResult.summary);
        } else if ("blocked".equals(finalResult.status) && !finalResult.ok && exit == 2) {
            update(State.BLOCKED, "Probe blocked (exit=" + exit + "): " + finalResult.summary);
        } else {
            update(State.FAILED, "Probe failed or result/exit disagreed (exit=" + exit + "): " + finalResult.summary);
        }
    }

    private void drain(InputStream stream, boolean structured) {
        try (Reader reader = new InputStreamReader(stream, StandardCharsets.UTF_8)) {
            char[] buffer = new char[2048];
            StringBuilder line = new StringBuilder();
            boolean oversized = false;
            int read;
            while ((read = reader.read(buffer)) != -1) {
                for (int index = 0; index < read; index++) {
                    char ch = buffer[index];
                    if (ch == '\n') {
                        acceptLine(line.toString(), oversized, structured);
                        line.setLength(0);
                        oversized = false;
                    } else if (line.length() < 65536) line.append(ch);
                    else oversized = true;
                }
            }
            if (line.length() > 0 || oversized) acceptLine(line.toString(), oversized, structured);
        } catch (IOException error) {
            if (!cancelled.get()) {
                synchronized (this) { streamFailure = true; }
                stderr.append("[pipe read failed: " + error.getMessage() + "]");
                listener.changed();
            }
        }
    }
    private void acceptLine(String line, boolean oversized, boolean structured) {
        if (line.endsWith("\r")) line = line.substring(0, line.length() - 1);
        if (structured) {
            synchronized (this) {
                if (oversized) protocolErrors++;
                else {
                    try {
                        Record record = parser.parse(line);
                        if (record != null) {
                            if ("ready".equals(record.event)) {
                                if (ready || resultCount > 0) protocolErrors++;
                                ready = true;
                            } else if ("result".equals(record.event)) {
                                result = record;
                                finalRecord = line;
                                resultCount++;
                            } else if (!"check".equals(record.event) || resultCount > 0) protocolErrors++;
                        }
                    } catch (IllegalArgumentException error) { protocolErrors++; }
                }
            }
        }
        String display = line.length() > 4096 ? line.substring(0, 4096) + " [display truncated]" : line;
        (structured ? stdout : stderr).append(display + (oversized ? " [oversized line]" : ""));
        listener.changed();
    }
    private static void stop(Process child) {
        if (!child.isAlive()) return;
        // onDestroy interrupts the worker. Clear that flag only for bounded
        // teardown so interruption cannot skip waiting for the forceful stop.
        boolean interrupted = Thread.interrupted();
        child.destroy();
        try {
            if (!child.waitFor(750, TimeUnit.MILLISECONDS)) {
                child.destroyForcibly();
                child.waitFor(1500, TimeUnit.MILLISECONDS);
            }
        } catch (InterruptedException error) {
            interrupted = true;
            child.destroyForcibly();
        } finally {
            if (interrupted) Thread.currentThread().interrupt();
        }
    }
    private static void close(Closeable stream) {
        try { stream.close(); } catch (IOException ignored) { /* Process already closed the pipe. */ }
    }
}
