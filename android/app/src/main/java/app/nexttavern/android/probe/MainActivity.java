package app.nexttavern.android.probe;

import android.app.Activity;
import android.content.pm.ApplicationInfo;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.system.Os;
import android.system.OsConstants;
import android.graphics.Typeface;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import app.nexttavern.android.probe.core.AssetInstaller;
import app.nexttavern.android.probe.core.ProbePaths;
import app.nexttavern.android.probe.core.ProcessSupervisor;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Deliberately a foreground runtime proof, not the NextTavern mobile product. */
public final class MainActivity extends Activity {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean refreshQueued = new AtomicBoolean();
    private volatile boolean destroyed;
    private ProcessSupervisor supervisor;
    private TextView status;
    private TextView stdout;
    private TextView stderr;
    private Button start;
    private Button stop;
    private Button copy;
    private CheckBox publicHttps;
    private boolean httpsClientRequested;
    private String evidenceHeader;
    private boolean softwareDiagnostic;
    private volatile String pageSizeEvidence = "not measured";

    @Override public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int padding = (int) (16 * getResources().getDisplayMetrics().density);
        content.setPadding(padding, padding, padding, padding);
        // target 36 enforces edge-to-edge; keep the proof UI clear of system bars.
        content.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(padding + insets.getSystemWindowInsetLeft(),
                padding + insets.getSystemWindowInsetTop(),
                padding + insets.getSystemWindowInsetRight(),
                padding + insets.getSystemWindowInsetBottom());
            return insets;
        });
        text(content, "NextTavern · Android G0 能力探针", 22, false);
        text(content, "仅验证原生 Node 运行路径，不是可用的手机端产品。\n能力测试通过 ≠ G0 通过；仍需真实 APK／设备验收。", 15, false);
        softwareDiagnostic = ProbePaths.softwareDiagnostic(getPackageName());
        boolean debug = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        evidenceHeader = "NextTavern Android capability probe\nPackage: " + getPackageName()
            + "\nVersion: " + BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")"
            + "\nDevice: " + Build.MANUFACTURER + " " + Build.MODEL
            + "\nAndroid " + Build.VERSION.RELEASE + " / API " + Build.VERSION.SDK_INT
            + "\nABI: " + String.join(", ", Build.SUPPORTED_ABIS)
            + "\n构建证据: " + (debug ? "DEBUG（不算 release 验证）" : "NON-DEBUG（仍需签名／安装证据）")
            + "\nDebuggable: " + debug
            + "\nNative library directory: " + getApplicationInfo().nativeLibraryDir
            + "\nTiming: " + (softwareDiagnostic ? "TEST-ONLY TCG / 120000ms each / 1800s supervisor; NOT phone performance"
                : BuildConfig.PROBE_KVM_DIAGNOSTIC ? "x64 KVM diagnostic / default 12000ms each / 180s supervisor; NOT phone performance" : "Default device probe budget")
            + "\nTarget API: " + getApplicationInfo().targetSdkVersion
            + "\n临时探针最低 API 26；不是产品最低版本承诺。";
        text(content, evidenceHeader, 13, false);
        publicHttps = new CheckBox(this);
        publicHttps.setText("可选：验证 example.com 公网 HTTPS（无密钥）");
        publicHttps.setChecked(false);
        content.addView(publicHttps);
        LinearLayout buttons = new LinearLayout(this);
        start = new Button(this);
        start.setText("运行能力探针");
        start.setOnClickListener(view -> startProbe());
        stop = new Button(this);
        stop.setText("停止");
        stop.setEnabled(false);
        stop.setOnClickListener(view -> { if (supervisor != null) supervisor.cancel(); });
        buttons.addView(start);
        buttons.addView(stop);
        content.addView(buttons);
        copy = new Button(this);
        copy.setText("复制测试记录");
        copy.setEnabled(false);
        copy.setOnClickListener(view -> copyEvidence());
        content.addView(copy);
        status = text(content, "尚未运行 · G0 未验证", 15, false);
        text(content, "stdout · 结构化测试记录（有界）", 15, false);
        stdout = text(content, "", 11, true);
        text(content, "stderr · 诊断（独立、有界）", 15, false);
        stderr = text(content, "", 11, true);
        text(content, "退出前台将停止本次测试；没有后台服务。脚本只复制到私有目录，原生可执行文件只能来自 APK 安装器提取目录。", 12, false);
        ScrollView scroll = new ScrollView(this);
        scroll.addView(content);
        setContentView(scroll);
    }

    private TextView text(LinearLayout parent, String value, int size, boolean monospace) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextIsSelectable(true);
        view.setPadding(0, 8, 0, 8);
        if (monospace) view.setTypeface(Typeface.MONOSPACE);
        parent.addView(view, new LinearLayout.LayoutParams(-1, -2));
        return view;
    }

    private void startProbe() {
        if (supervisor != null && supervisor.snapshot().state == ProcessSupervisor.State.RUNNING) return;
        ProcessSupervisor run = new ProcessSupervisor(new JsonProtocolParser(), this::queueRefresh);
        final boolean httpsClient = publicHttps.isChecked();
        httpsClientRequested = httpsClient;
        publicHttps.setEnabled(false);
        supervisor = run;
        run.preparing();
        worker.execute(() -> {
            File bundle = null;
            try {
                pageSizeEvidence = Long.toString(Os.sysconf(OsConstants._SC_PAGESIZE)) + " bytes";
                File runtime = ProbePaths.runtime(new File(getApplicationInfo().nativeLibraryDir));
                File data = ProbePaths.privateDirectory(getFilesDir(), "probe-data");
                AssetInstaller installer = new AssetInstaller(new AssetInstaller.Source() {
                    @Override public String[] list(String path) throws IOException {
                        String[] result = getAssets().list(path.isEmpty() ? "probe" : "probe/" + path);
                        return result == null ? new String[0] : result;
                    }
                    @Override public InputStream open(String path) throws IOException { return getAssets().open("probe/" + path); }
                });
                if (run.isCancelled()) { run.blocked("Cancelled during preparation"); return; }
                bundle = installer.install(getFilesDir());
                run.run(ProbePaths.command(runtime, bundle, softwareDiagnostic, httpsClient), data, ProbePaths.supervisorTimeoutSeconds(softwareDiagnostic));
            } catch (IOException | RuntimeException error) {
                run.blocked(error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage());
            } finally {
                if (bundle != null) {
                    try { AssetInstaller.remove(bundle); }
                    catch (IOException error) {
                        // Private data only, never executable. A cleanup error is visible, not a success claim.
                        run.blocked("Private probe bundle cleanup failed: " + error.getMessage());
                    }
                }
                queueRefresh();
            }
        });
    }

    private void queueRefresh() {
        if (destroyed || !refreshQueued.compareAndSet(false, true)) return;
        // Coalesce pipe-reader callbacks: child output cannot create an unbounded UI queue.
        main.postDelayed(() -> {
            refreshQueued.set(false);
            if (destroyed || supervisor == null) return;
            ProcessSupervisor.Snapshot snapshot = supervisor.snapshot();
            status.setText(label(snapshot.state) + "\nready=" + snapshot.ready + "\n" + snapshot.detail);
            stdout.setText(snapshot.stdout);
            stderr.setText(snapshot.stderr);
            boolean running = snapshot.state == ProcessSupervisor.State.RUNNING;
            start.setEnabled(!running);
            stop.setEnabled(running);
            copy.setEnabled(!running);
            publicHttps.setEnabled(!running);
        }, 100);
    }
    private void copyEvidence() {
        if (supervisor == null) return;
        ProcessSupervisor.Snapshot snapshot = supervisor.snapshot();
        String evidence = evidenceHeader + "\nOS page size: " + pageSizeEvidence
            + "\nFixed public HTTPS explicitly requested: " + httpsClientRequested
            + "\n\nFull G0 accepted: false\nState: " + snapshot.state
            + "\nReady: " + snapshot.ready + "\n" + snapshot.detail
            + "\n\n=== Final protocol record (max 65,536 characters) ===\n" + snapshot.finalRecord
            + "\n\n=== stdout (bounded display log) ===\n" + snapshot.stdout
            + "\n=== stderr (bounded diagnostic log) ===\n" + snapshot.stderr;
        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        if (clipboard != null) {
            clipboard.setPrimaryClip(ClipData.newPlainText("NextTavern Android probe evidence", evidence));
            Toast.makeText(this, "已复制探针记录；不代表 G0 通过", Toast.LENGTH_SHORT).show();
        }
    }

    private static String label(ProcessSupervisor.State state) {
        switch (state) {
            case RUNNING: return "运行中 · G0 未验证";
            case CAPABILITIES_PASSED: return "能力探针通过 · 不代表 G0 通过";
            case BLOCKED: return "BLOCKED · 不能视为通过";
            case FAILED: return "失败 · G0 未验证";
            case CANCELLED: return "已取消 · 未通过";
            case TIMED_OUT: return "超时 · 未通过";
            default: return "尚未运行 · G0 未验证";
        }
    }
    @Override protected void onStop() {
        if (supervisor != null && supervisor.snapshot().state == ProcessSupervisor.State.RUNNING) supervisor.cancel();
        super.onStop();
    }
    @Override protected void onDestroy() {
        destroyed = true;
        if (supervisor != null) supervisor.cancel();
        worker.shutdownNow();
        main.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
