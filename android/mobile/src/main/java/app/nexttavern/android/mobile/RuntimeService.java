package app.nexttavern.android.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import app.nexttavern.android.mobile.core.CodeBundle;
import app.nexttavern.android.mobile.core.OriginPolicy;
import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** The service, not an Activity/WebView instance, owns the live local host. */
public final class RuntimeService extends Service implements NodeSession.Events {
    public static final String START = "app.nexttavern.android.mobile.START";
    public static final String STOP = "app.nexttavern.android.mobile.STOP";
    private static final int NOTIFICATION_ID = 1;
    private static final String CHANNEL = "local-runtime";
    public enum State { STOPPED, STARTING, RUNNING, STOPPING, ERROR }
    public static final class Snapshot {
        public final State state;
        public final String generation;
        public final String url; // In-memory binder only; never saved/logged/put in notification.
        public final String message;
        public final OriginPolicy origin;
        Snapshot(State state, String generation, String url, String message) { this(state, generation, url, message, null); }
        Snapshot(State state, String generation, String url, String message, OriginPolicy origin) {
            this.state = state; this.generation = generation; this.url = url; this.message = message; this.origin = origin;
        }
    }
    public final class LocalBinder extends Binder { RuntimeService service() { return RuntimeService.this; } }
    private final LocalBinder binder = new LocalBinder();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService control;
    private final CopyOnWriteArrayList<Runnable> observers = new CopyOnWriteArrayList<>();
    // Main owns lifecycle publication. The worker only installs/creates and performs
    // process I/O; every queued action retains its original start's identity.
    private static final class Start {
        final String generation = UUID.randomUUID().toString();
        final AtomicBoolean cancelled = new AtomicBoolean();
        volatile NodeSession session;
        String processError;
        boolean finished;
    }
    private Start active;
    private boolean destroyed;
    private Snapshot current = new Snapshot(State.STOPPED, "", null, "本地服务尚未启动");

    public RuntimeService() { this(Executors.newSingleThreadExecutor()); }
    RuntimeService(ExecutorService control) { this.control = control; }

    @Override public void onCreate() {
        super.onCreate();
        NotificationManager notifications = getSystemService(NotificationManager.class);
        notifications.createNotificationChannel(new NotificationChannel(CHANNEL, "NextTavern 本地运行", NotificationManager.IMPORTANCE_LOW));
    }
    @Override public IBinder onBind(Intent intent) { return binder; }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && STOP.equals(intent.getAction())) requestStop(false);
        else if (intent != null && START.equals(intent.getAction())) {
            if (snapshot().state == State.STOPPED || snapshot().state == State.ERROR) {
                foreground("正在准备本地服务");
                Start start = new Start();
                active = start;
                set(new Snapshot(State.STARTING, start.generation, null, "正在准备本地代码；已有故事数据会保留"));
                control.execute(() -> start(start));
            }
        }
        return START_NOT_STICKY;
    }
    public synchronized Snapshot snapshot() { return current; }
    public void observe(Runnable observer) { observers.add(observer); }
    public void unobserve(Runnable observer) { observers.remove(observer); }
    private void set(Snapshot value) {
        synchronized (this) { current = value; }
        main.post(() -> { if (!destroyed) for (Runnable observer : observers) observer.run(); });
    }
    private void start(Start start) {
        try {
            String version;
            try (BufferedReader input = new BufferedReader(new InputStreamReader(getAssets().open("host-version.txt"), StandardCharsets.US_ASCII))) {
                version = input.readLine();
            }
            if (version == null || !version.matches("[a-f0-9]{64}")) throw new IOException("HOST_ASSET_VERSION_INVALID");
            File code = CodeBundle.install(new File(getFilesDir(), "code"), version,
                getAssets().open("host.zip"), start.cancelled::get);
            if (start.cancelled.get()) { main.post(() -> stopped(start, "启动已取消")); return; }
            File home = directory("home");
            File workspace = directory("workspace");
            File memory = directory("memory");
            File tmp = directory("tmp");
            NodeSession running = new NodeSession(new File(getApplicationInfo().nativeLibraryDir), code,
                new File(getApplicationInfo().dataDir).getCanonicalFile(), home, workspace, memory, tmp, start.generation, this,
                BuildConfig.DEBUG && "x86Diagnostic".equals(BuildConfig.FLAVOR)
                    ? new File(getCacheDir(), "node-stderr.log") : null);
            start.session = running;
            // Destruction/Stop may occur while ProcessBuilder.start is in flight.
            // Publish only to this start; cancellation is never reset by a new start.
            if (start.cancelled.get()) running.terminate();
            running.observe();
        } catch (IOException | RuntimeException error) {
            main.post(() -> {
                if (start.cancelled.get()) stopped(start, "启动已取消");
                else failed(start, "HOST_START_FAILED"); // Never expose host output.
            });
        }
    }
    private File directory(String child) throws IOException {
        File directory = new File(getFilesDir(), child);
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("PRIVATE_STORAGE_UNAVAILABLE");
        return directory.getCanonicalFile();
    }
    public void requestStop(boolean force) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            main.post(() -> requestStop(force));
            return;
        }
        Start start = active;
        if (!owns(start)) return;
        start.cancelled.set(true);
        set(new Snapshot(State.STOPPING, start.generation, null,
            force ? "正在强制停止；未完成回应可能中断" : "正在请求停止并收尾；当前生成会中断"));
        foreground("正在停止本地服务");
        control.execute(() -> {
            NodeSession running = start.session;
            if (running == null) { main.post(() -> stopped(start, "本地服务已停止")); return; }
            if (force) running.forceDestroy();
            else {
                try { running.stop(); }
                catch (IOException error) { running.terminate(); }
            }
        });
    }
    private boolean owns(Start start) {
        return !destroyed && start != null && active == start && !start.finished;
    }
    private boolean owns(NodeSession owner) {
        return owns(active) && active.session == owner;
    }
    @Override public void ready(NodeSession owner, String url, String hostVersion, OriginPolicy origin) {
        main.post(() -> {
            if (!owns(owner) || active.cancelled.get() || snapshot().state != State.STARTING) return;
            set(new Snapshot(State.RUNNING, active.generation, url, "本地服务运行中", origin));
            // Notification and state are published together, never via a stale queued update.
            foreground("本地服务运行中；离开界面不会中断故事");
        });
    }
    @Override public void error(NodeSession owner, String code) {
        main.post(() -> {
            if (!owns(owner)) return;
            active.processError = code;
            set(new Snapshot(State.STOPPING, active.generation, null, "服务发生错误，正在停止（" + code + "）"));
            foreground("正在停止本地服务");
            control.execute(owner::terminate);
        });
    }
    @Override public void stopped(NodeSession owner) {
        main.post(() -> {
            if (!owns(owner)) return;
            set(new Snapshot(State.STOPPING, active.generation, null, "已收到中断确认，正在退出本地服务"));
            foreground("正在停止本地服务");
            control.execute(owner::terminate);
        });
    }
    @Override public void exited(NodeSession owner, int exit) {
        main.post(() -> {
            if (!owns(owner)) return;
            Start start = active;
            start.session = null;
            if (start.processError != null) failed(start, start.processError);
            else if (start.cancelled.get() || exit == 0) stopped(start, "本地服务已停止；本轮可能已中断，先前故事仍保留");
            else failed(start, "HOST_EXIT_" + exit);
        });
    }
    private void failed(Start start, String code) {
        if (!owns(start)) return;
        start.finished = true;
        set(new Snapshot(State.ERROR, start.generation, null, "本地服务未能运行（" + code + "）"));
        main.post(() -> releaseForeground(start));
    }
    private void stopped(Start start, String message) {
        if (!owns(start)) return;
        start.finished = true;
        set(new Snapshot(State.STOPPED, start.generation, null, message));
        main.post(() -> releaseForeground(start));
    }
    private void releaseForeground(Start start) {
        if (!destroyed && active == start && start.finished) {
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
        }
    }
    private void foreground(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent content = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent stop = new Intent(this, RuntimeService.class).setAction(STOP);
        PendingIntent action = PendingIntent.getService(this, 1, stop, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle("NextTavern 本地服务")
            .setContentText(text).setContentIntent(content).setOngoing(true)
            .addAction(new Notification.Action.Builder(null, "停止（中断当前生成）", action).build()).build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(NOTIFICATION_ID, notification);
    }
    @Override public void onDestroy() {
        destroyed = true;
        observers.clear();
        Start start = active;
        if (start != null) {
            start.cancelled.set(true);
            // Queued behind construction, so even an in-flight process is reclaimed.
            control.execute(() -> {
                NodeSession running = start.session;
                if (running != null) running.terminate();
            });
        }
        control.shutdown();
        super.onDestroy();
    }
}
