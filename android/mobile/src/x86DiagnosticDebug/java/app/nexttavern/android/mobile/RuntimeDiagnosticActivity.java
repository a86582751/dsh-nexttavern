package app.nexttavern.android.mobile;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.util.AtomicFile;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONException;
import org.json.JSONObject;

/** Explicit x86 debug backend diagnosis. Never creates a WebView or bypasses Host authentication. */
public final class RuntimeDiagnosticActivity extends Activity {
    private RuntimeService service;
    private boolean bound;
    private volatile boolean active;
    private volatile String requestedGeneration;
    private TextView status;
    private Button start;
    private Button stop;
    private AtomicFile readyFile;
    private final ExecutorService cacheWriter = Executors.newSingleThreadExecutor();
    private final Runnable observer = this::render;
    private final ServiceConnection connection = new ServiceConnection() {
        @Override public void onServiceConnected(ComponentName name, IBinder binder) {
            if (!active) return;
            service = ((RuntimeService.LocalBinder) binder).service();
            service.observe(observer);
            render();
        }
        @Override public void onServiceDisconnected(ComponentName name) {
            if (service != null) service.unobserve(observer);
            service = null;
            clearReady();
            start.setEnabled(false);
            stop.setEnabled(false);
            status.setText("DISCONNECTED\n本地服务连接中断；重新打开诊断界面可恢复连接。");
        }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        readyFile = new AtomicFile(new File(getCacheDir(), "runtime-diagnostic-ready.json"));
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        status = new TextView(this);
        status.setPadding(12, 8, 12, 8);
        status.setText("STOPPED\n后端诊断：无 WebView。连接后请显式点击启动。");
        root.addView(status);
        LinearLayout actions = new LinearLayout(this);
        start = button(actions, "启动后端", () -> {
            if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, 43);
            }
            startForegroundService(new Intent(this, RuntimeService.class).setAction(RuntimeService.START));
        });
        stop = button(actions, "停止后端", this::confirmStop);
        start.setEnabled(false);
        stop.setEnabled(false);
        root.addView(actions);
        setContentView(root);
    }

    private Button button(LinearLayout parent, String label, Runnable action) {
        Button button = new Button(this);
        button.setText(label);
        button.setOnClickListener(view -> action.run());
        parent.addView(button);
        return button;
    }

    private void render() {
        if (!active || service == null) return;
        RuntimeService.Snapshot snapshot = service.snapshot();
        status.setText(snapshot.state.name() + "\n" + snapshot.message);
        boolean idle = snapshot.state == RuntimeService.State.STOPPED || snapshot.state == RuntimeService.State.ERROR;
        start.setEnabled(idle);
        stop.setEnabled(!idle);
        stop.setText(snapshot.state == RuntimeService.State.STOPPING ? "强制停止后端" : "停止后端");
        if (snapshot.state == RuntimeService.State.RUNNING) {
            if (!snapshot.generation.equals(requestedGeneration)) {
                clearReady();
                requestedGeneration = snapshot.generation;
                cacheWriter.execute(() -> writeReady(snapshot.generation, snapshot.url));
            }
        } else if (requestedGeneration != null) clearReady();
    }

    private void writeReady(String generation, String url) {
        if (!active || !generation.equals(requestedGeneration)) return;
        FileOutputStream output = null;
        try {
            JSONObject record = new JSONObject();
            record.put("schemaVersion", 1);
            record.put("generation", generation);
            record.put("url", url);
            output = readyFile.startWrite();
            output.write(record.toString().getBytes(StandardCharsets.UTF_8));
            readyFile.finishWrite(output);
        } catch (IOException | JSONException error) {
            if (output != null) readyFile.failWrite(output);
            readyFile.delete();
            runOnUiThread(() -> {
                if (active && generation.equals(requestedGeneration)) {
                    status.setText("诊断就绪文件写入失败；本地服务状态未改变。");
                }
            });
        }
    }

    private void clearReady() {
        requestedGeneration = null;
        // One serial owner orders deletion after any in-flight write, including onStop.
        cacheWriter.execute(readyFile::delete);
    }

    private void confirmStop() {
        if (service == null) return;
        boolean force = service.snapshot().state == RuntimeService.State.STOPPING;
        new AlertDialog.Builder(this).setTitle(force ? "强制停止后端？" : "停止后端？")
            .setMessage(force ? "未完成工作会被强制中断；已保存故事不会主动删除。"
                : "将中断当前生成并请求现有服务收尾；已保存故事会保留。")
            .setNegativeButton("继续运行", null)
            .setPositiveButton(force ? "强制停止" : "停止并收尾", (dialog, which) -> {
                if (service != null) service.requestStop(force);
            }).show();
    }

    @Override protected void onStart() {
        super.onStart();
        active = true;
        clearReady();
        bound = bindService(new Intent(this, RuntimeService.class), connection, BIND_AUTO_CREATE);
    }

    @Override protected void onStop() {
        active = false;
        clearReady();
        if (service != null) service.unobserve(observer);
        if (bound) unbindService(connection);
        bound = false;
        service = null;
        super.onStop(); // Leaving this diagnostic does not stop the real RuntimeService.
    }

    @Override protected void onDestroy() {
        cacheWriter.shutdown(); // Drain the final onStop deletion; do not abandon queued cleanup.
        super.onDestroy();
    }
}
