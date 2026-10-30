package app.nexttavern.android.mobile;

import android.content.Intent;
import android.os.Handler;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.AbstractExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/** Runs the real service against controllable main/control queues and process I/O. */
public final class RuntimeServiceTest {
    private static final class Control extends AbstractExecutorService {
        final ArrayDeque<Runnable> tasks = new ArrayDeque<>();
        boolean shutdown;
        @Override public void execute(Runnable task) {
            if (shutdown) throw new AssertionError("Work submitted after destruction");
            tasks.add(task);
        }
        void next() { tasks.remove().run(); }
        void drain() { while (!tasks.isEmpty()) next(); }
        @Override public void shutdown() { shutdown = true; }
        @Override public List<Runnable> shutdownNow() { shutdown(); return Collections.emptyList(); }
        @Override public boolean isShutdown() { return shutdown; }
        @Override public boolean isTerminated() { return shutdown && tasks.isEmpty(); }
        @Override public boolean awaitTermination(long time, TimeUnit unit) { return isTerminated(); }
    }
    private static RuntimeService service(Control control) throws Exception {
        RuntimeService service = new RuntimeService(control);
        service.files = Files.createTempDirectory("mobile-runtime-test-").toFile();
        service.assets.assets.put("host-version.txt", (String.join("", Collections.nCopies(64, "a")) + "\n").getBytes(StandardCharsets.US_ASCII));
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry("host-launch.mjs"));
            zip.write("// fixture".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        service.assets.assets.put("host.zip", bytes.toByteArray());
        NodeSession.constructing = null;
        return service;
    }
    private static void start(RuntimeService service) {
        service.onStartCommand(new Intent().setAction(RuntimeService.START), 0, 1);
    }
    private static void check(boolean value, String message) {
        if (!value) throw new AssertionError(message);
    }
    public static void main(String[] args) throws Exception {
        lateReadyAfterStop();
        cancelledStartCannotStopReplacement();
        stopDuringConstruction();
        destructionDuringConstruction();
        queuedCallbacksAfterDestruction();
        System.out.println("RuntimeService lifecycle regressions passed");
    }
    private static void lateReadyAfterStop() throws Exception {
        Control control = new Control(); RuntimeService service = service(control);
        start(service); control.next(); NodeSession process = NodeSession.latest;
        process.ready(); // Stdout has queued READY, but main has not admitted it.
        check(service.snapshot().state == RuntimeService.State.STARTING, "stdout cannot publish state outside main processing");
        service.requestStop(false); Handler.drain();
        check(service.snapshot().state == RuntimeService.State.STOPPING, "late READY must not undo Stop");
        check(service.snapshot().url == null, "late READY must not restore URL");
        check("正在停止本地服务".equals(service.notification), "late READY must not replace stopping notification");
        service.requestStop(true); control.drain();
        check(process.stops == 1 && process.forces == 1, "ordinary and confirmed force stop remain reachable");
        process.events.exited(process, 0); Handler.drain();
        check(service.snapshot().state == RuntimeService.State.STOPPED, "exit completes stop");
        service.onDestroy(); control.drain();
    }
    private static void cancelledStartCannotStopReplacement() throws Exception {
        Control control = new Control(); RuntimeService service = service(control);
        start(service); String first = service.snapshot().generation;
        service.requestStop(false); service.requestStop(false);
        control.next();
        while (service.snapshot().state != RuntimeService.State.STOPPED) Handler.next();
        // A has completed; its Stops and foreground-release callback are still queued.
        check(service.snapshot().state == RuntimeService.State.STOPPED, "cancelled install completes");
        start(service); String replacement = service.snapshot().generation;
        check(!first.equals(replacement), "replacement has fresh identity");
        int releases = service.releases;
        control.next(); control.next(); Handler.drain(); // Both stale Stops see A's null process.
        check(service.snapshot().state == RuntimeService.State.STARTING, "A's queued Stop must not complete B");
        check(replacement.equals(service.snapshot().generation), "B retains identity");
        check(service.releases == releases && service.notification != null, "B retains foreground ownership");
        control.next(); NodeSession process = NodeSession.latest; process.ready(); Handler.drain();
        check(service.snapshot().state == RuntimeService.State.RUNNING, "B reaches readiness");
        check(process.stops == 0 && process.terminations == 0, "A's Stop never targets B's process");
        service.onDestroy(); control.drain();
    }
    private static void stopDuringConstruction() throws Exception {
        Control control = new Control(); RuntimeService service = service(control);
        start(service);
        NodeSession.constructing = () -> service.requestStop(false);
        control.next(); NodeSession process = NodeSession.latest;
        process.ready(); Handler.drain(); control.drain();
        check(service.snapshot().state == RuntimeService.State.STOPPING, "cancelled process remains owned until exit");
        check(process.terminations > 0 && process.forces == 0, "construction cancellation requests ordinary termination");
        process.events.exited(process, 0); Handler.drain();
        check(service.snapshot().state == RuntimeService.State.STOPPED, "cancelled process exit completes its generation");
        service.onDestroy(); control.drain();
        NodeSession.constructing = null;
    }
    private static void destructionDuringConstruction() throws Exception {
        Control control = new Control(); RuntimeService service = service(control);
        start(service);
        NodeSession.constructing = service::onDestroy;
        control.next(); NodeSession process = NodeSession.latest;
        process.ready(); process.events.error(process, "FIXTURE_ERROR"); process.events.stopped(process);
        Handler.drain(); control.drain();
        check(process.terminations > 0, "process created across destruction receives ordinary termination");
        check(process.forces == 0, "destruction never implies force-kill");
        check(service.snapshot().url == null, "destroyed service cannot adopt late readiness");
        check(control.isTerminated(), "destruction drains previously queued cleanup");
        NodeSession.constructing = null;
    }
    private static void queuedCallbacksAfterDestruction() throws Exception {
        Control control = new Control(); RuntimeService service = service(control);
        start(service); control.next(); NodeSession process = NodeSession.latest;
        process.ready(); process.events.error(process, "FIXTURE_ERROR"); process.events.stopped(process);
        service.onDestroy(); Handler.drain(); control.drain();
        check(process.terminations == 1, "owned process terminated once by destruction, not late callbacks");
        check(service.snapshot().url == null, "queued READY cannot publish after destruction");
    }
}
