package app.nexttavern.android.probe.core;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/** No JUnit/SDK dependency: execute through app/tools/test-core.sh. */
public final class CoreTest {
    private static int checks;
    private static final ProcessSupervisor.Parser PARSER = line -> {
        switch (line) {
            case "ready": return new ProcessSupervisor.Record("ready", "", false, "", "");
            case "pass": return new ProcessSupervisor.Record("result", "passed", true, "android", "test");
            case "desktop": return new ProcessSupervisor.Record("result", "passed", true, "linux", "test");
            case "blocked": return new ProcessSupervisor.Record("result", "blocked", false, "android", "missing addon");
            case "bad": throw new IllegalArgumentException("malformed test record");
            default: return null;
        }
    };
    public static void main(String[] args) throws Exception {
        File temporary = Files.createTempDirectory("nexttavern-core-test-").toFile();
        try {
            paths(temporary);
            if (args.length == 0) {
                assets(temporary);
                logs();
                supervision(temporary);
            } else if (!"paths".equals(args[0])) throw new IllegalArgumentException("Use paths or no filter");
        } finally { AssetInstaller.remove(temporary); }
        System.out.println("PASS: " + checks + " core assertions (desktop Java only; no Android/G0 claim)");
    }
    private static void paths(File root) throws Exception {
        check(!ProbePaths.softwareDiagnostic("app.nexttavern.android.probe.x86kvm"), "x64 KVM selection never implies TCG timing");
        check(!ProbePaths.softwareDiagnostic("app.nexttavern.android.probe.x86kvm.debug"), "debug KVM keeps default timing too");
        check(ProbePaths.softwareDiagnostic("app.nexttavern.android.probe.x86diagnostic"), "legacy TCG diagnostic remains explicit");
        File data = ProbePaths.privateDirectory(root, "probe-data");
        check(data.equals(ProbePaths.privateDirectory(root, "probe-data")), "stable data cwd");
        fails(() -> ProbePaths.privateDirectory(root, "../outside"), "reject directory traversal");
        File nativeDir = new File(root, "native");
        check(nativeDir.mkdir(), "create synthetic native directory");
        fails(() -> ProbePaths.runtime(nativeDir), "missing runtime is blocked");
        File runtime = new File(nativeDir, ProbePaths.RUNTIME_NAME);
        Files.write(runtime.toPath(), new byte[] {0});
        check(runtime.setExecutable(true), "mark synthetic test fixture executable");
        check(ProbePaths.runtime(nativeDir).equals(runtime.getCanonicalFile()), "installer-owned launch path");
        File bundle = new File(root, "command-bundle");
        check(bundle.mkdir(), "create command fixture");
        fails(() -> ProbePaths.command(runtime, bundle), "missing entry rejected");
        File entry = new File(bundle, "run.mts");
        Files.write(entry.toPath(), "export {};".getBytes(StandardCharsets.UTF_8));
        List<String> command = ProbePaths.command(runtime, bundle);
        check(command.equals(Arrays.asList(runtime.getAbsolutePath(), "--experimental-strip-types", entry.getAbsolutePath())),
            "direct argument vector without shell");
        check(ProbePaths.command(runtime, bundle, true).equals(Arrays.asList(runtime.getAbsolutePath(),
            "--experimental-strip-types", entry.getAbsolutePath(), "--timeout-ms", "120000")),
            "explicit software diagnostic argv passes per-check budget");
        check(ProbePaths.supervisorTimeoutSeconds(false) == 180, "device supervisor budget unchanged");
        check(ProbePaths.supervisorTimeoutSeconds(true) == 1800, "software diagnostic supervisor covers extended checks");
        fails(() -> ProbePaths.command(runtime, bundle, false, true), "HTTPS opt-in requires the bundled locked CA");
        File certificates = new File(bundle, "certs");
        check(certificates.mkdir(), "create public certificate fixture directory");
        Files.write(new File(certificates, "ca-certificates.pem").toPath(), new byte[] {0});
        check(ProbePaths.command(runtime, bundle, false, true).equals(Arrays.asList(runtime.getAbsolutePath(),
            "--experimental-strip-types", entry.getAbsolutePath(), "--https-client")),
            "explicit HTTPS opt-in keeps default KVM/device budgets");
        check(ProbePaths.command(runtime, bundle, false, true, true).equals(Arrays.asList(runtime.getAbsolutePath(),
            "--experimental-strip-types", entry.getAbsolutePath(), "--https-client", "--atomic-publish")),
            "atomic publication is a separate explicit flag after HTTPS");
        check(ProbePaths.command(runtime, bundle, false, false, true).contains("--atomic-publish"),
            "atomic publication opt-in does not require HTTPS");
        Map<String, String> environment = ProcessSupervisor.processBuilder(command, data).environment();
        check(environment.get("SSL_CERT_FILE").equals(new File(certificates, "ca-certificates.pem").getAbsolutePath()),
            "probe uses the private certificate asset, like mobile");
        check(environment.get("SSL_CERT_DIR").equals(certificates.getAbsolutePath()), "probe CA directory relocated");
        check(environment.get("OPENSSL_CONF").equals(""), "probe never uses inaccessible Termux OpenSSL config");
        check(environment.get("LD_LIBRARY_PATH").equals(nativeDir.getAbsolutePath()), "native closure remains installer-owned");
        File symlink = new File(root, "linked-data");
        Files.createSymbolicLink(symlink.toPath(), data.toPath());
        fails(() -> ProbePaths.privateDirectory(root, "linked-data"), "reject private data symlink");
        check(runtime.delete(), "remove synthetic runtime");
        Files.createSymbolicLink(runtime.toPath(), entry.toPath());
        fails(() -> ProbePaths.runtime(nativeDir), "reject native runtime symlink");
    }
    private static void assets(File root) throws Exception {
        Map<String, String> files = new HashMap<>();
        files.put("run.mts", "export {};");
        files.put("fixtures/test.pem", "fixture only");
        File bundle = new AssetInstaller(source(files, false)).install(root);
        check(new File(bundle, "run.mts").isFile(), "activate complete entry");
        check(new File(bundle, "fixtures/test.pem").isFile(), "copy nested fixtures");
        check(!new File(bundle, "run.mts").canExecute(), "scripts are never chmod executable");
        AssetInstaller.remove(bundle);
        fails(() -> new AssetInstaller(source(files, true)).install(root), "asset copy failure propagates");
        File[] leftovers = new File(root, "probe-bundles").listFiles();
        check(leftovers != null && leftovers.length == 0, "failed transaction leaves no active/staging bundle");
        Map<String, String> traversal = Collections.singletonMap("../escape.mts", "unsafe");
        fails(() -> new AssetInstaller(source(traversal, false)).install(root), "unsafe APK asset name rejected");
    }
    private static AssetInstaller.Source source(Map<String, String> files, boolean failOpen) {
        return new AssetInstaller.Source() {
            @Override public String[] list(String path) {
                String prefix = path.isEmpty() ? "" : path + "/";
                java.util.TreeSet<String> children = new java.util.TreeSet<>();
                for (String name : files.keySet()) {
                    if (name.startsWith(prefix)) children.add(name.substring(prefix.length()).split("/")[0]);
                }
                return children.toArray(new String[0]);
            }
            @Override public InputStream open(String path) throws IOException {
                if (failOpen) throw new IOException("simulated interrupted copy");
                String contents = files.get(path);
                if (contents == null) throw new IOException("missing fixture");
                return new ByteArrayInputStream(contents.getBytes(StandardCharsets.UTF_8));
            }
        };
    }
    private static void logs() {
        BoundedLog log = new BoundedLog(2, 12);
        log.append("first"); log.append("second"); log.append("third");
        check(!log.text().contains("first") && log.text().contains("older lines omitted"), "bounded log drops old lines");
        log.append("01234567890123456789");
        check(log.text().endsWith("012345678901\n") && !log.text().contains("0123456789012"), "oversized log entry clipped");
    }
    private static void supervision(File cwd) throws Exception {
        check(run(cwd, "ready\npass\n", "", 0).state == ProcessSupervisor.State.CAPABILITIES_PASSED,
            "ready + one Android capability success + exit0 passes capabilities only");
        check(run(cwd, "pass\n", "", 0).state == ProcessSupervisor.State.FAILED, "no readiness is failure");
        check(run(cwd, "ready\npass\npass\n", "", 0).state == ProcessSupervisor.State.FAILED, "duplicate result is failure");
        check(run(cwd, "ready\nbad\npass\n", "", 0).state == ProcessSupervisor.State.FAILED, "malformed protocol is failure");
        check(run(cwd, "ready\npass\n", "", 1).state == ProcessSupervisor.State.FAILED, "exit mismatch is failure");
        check(run(cwd, "ready\ndesktop\n", "", 0).state == ProcessSupervisor.State.FAILED, "desktop record cannot pass Android capability");
        check(run(cwd, "ready\nblocked\n", "", 2).state == ProcessSupervisor.State.BLOCKED, "structured blocking is not success");
        check(run(cwd, "ready\nblocked\n", "", 3).state == ProcessSupervisor.State.FAILED,
            "blocked result requires the documented blocked exit code");
        check(run(cwd, "ready\npass\n", "", 0).finalRecord.equals("pass"),
            "preserve bounded full final record for user-copyable evidence");
        ProcessSupervisor.Snapshot split = run(cwd, "ready\n", "pass\n", 0);
        check(split.state == ProcessSupervisor.State.FAILED && split.stderr.contains("pass"), "stderr cannot spoof results");
        char[] huge = new char[70000]; Arrays.fill(huge, 'x');
        check(run(cwd, new String(huge) + "\nready\npass\n", "", 0).state == ProcessSupervisor.State.FAILED,
            "oversized stdout cannot bypass protocol bounds");
        AtomicBoolean launched = new AtomicBoolean();
        ProcessSupervisor cancelled = new ProcessSupervisor(PARSER, () -> {}, (command, dir) -> {
            launched.set(true); return new FakeProcess("", "", 0, false);
        });
        cancelled.cancel(); cancelled.run(Collections.singletonList("unused"), cwd, 1);
        check(!launched.get() && cancelled.snapshot().state == ProcessSupervisor.State.CANCELLED, "cancel before launch is safe");
        FakeProcess hanging = new FakeProcess("ready\n", "", 0, true);
        ProcessSupervisor timeout = new ProcessSupervisor(PARSER, () -> {}, (command, dir) -> hanging);
        timeout.run(Collections.singletonList("unused"), cwd, 0);
        check(timeout.snapshot().state == ProcessSupervisor.State.TIMED_OUT && hanging.destroyed,
            "deadline tears native process down");
        FakeProcess active = new FakeProcess("ready\n", "", 0, true);
        ProcessSupervisor supervisor = new ProcessSupervisor(PARSER, () -> {}, (command, dir) -> active);
        Thread worker = new Thread(() -> supervisor.run(Collections.singletonList("unused"), cwd, 10));
        worker.start();
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(2);
        while (supervisor.snapshot().state != ProcessSupervisor.State.RUNNING && System.nanoTime() < deadline) Thread.yield();
        supervisor.cancel(); worker.join(3000);
        check(!worker.isAlive() && active.destroyed && supervisor.snapshot().state == ProcessSupervisor.State.CANCELLED,
            "lifecycle cancellation stops an active process");
        ProcessSupervisor denied = new ProcessSupervisor(PARSER, () -> {}, (command, dir) -> { throw new IOException("EACCES"); });
        denied.run(Collections.singletonList("unused"), cwd, 1);
        check(denied.snapshot().state == ProcessSupervisor.State.BLOCKED, "exec denial is blocked, not green");
    }
    private static ProcessSupervisor.Snapshot run(File cwd, String out, String err, int exit) {
        ProcessSupervisor supervisor = new ProcessSupervisor(PARSER, () -> {},
            (command, dir) -> new FakeProcess(out, err, exit, false));
        supervisor.run(Collections.singletonList("unused"), cwd, 1);
        return supervisor.snapshot();
    }
    private static final class FakeProcess extends Process {
        private final InputStream out;
        private final InputStream err;
        private final int code;
        private volatile boolean alive;
        private volatile boolean destroyed;
        FakeProcess(String out, String err, int code, boolean hang) {
            this.out = new ByteArrayInputStream(out.getBytes(StandardCharsets.UTF_8));
            this.err = new ByteArrayInputStream(err.getBytes(StandardCharsets.UTF_8));
            this.code = code;
            this.alive = hang;
        }
        @Override public OutputStream getOutputStream() { return new ByteArrayOutputStream(); }
        @Override public InputStream getInputStream() { return out; }
        @Override public InputStream getErrorStream() { return err; }
        @Override public int waitFor() throws InterruptedException { while (alive) Thread.sleep(5); return code; }
        @Override public boolean waitFor(long timeout, TimeUnit unit) throws InterruptedException {
            if (alive) Thread.sleep(Math.min(5, unit.toMillis(timeout)));
            return !alive;
        }
        @Override public int exitValue() { if (alive) throw new IllegalThreadStateException(); return code; }
        @Override public void destroy() { destroyed = true; alive = false; }
        @Override public Process destroyForcibly() { destroy(); return this; }
        @Override public boolean isAlive() { return alive; }
    }
    private interface Checked { void run() throws Exception; }
    private static void fails(Checked operation, String label) throws Exception {
        try { operation.run(); } catch (IOException error) { checks++; return; }
        throw new AssertionError("Expected IOException: " + label);
    }
    private static void check(boolean value, String label) {
        checks++;
        if (!value) throw new AssertionError(label);
    }
}
