package android.app;
import android.content.*; import android.content.pm.*; import android.content.res.*; import android.os.*; import java.io.File;
public class Service {
    public static final int START_NOT_STICKY=2, STOP_FOREGROUND_REMOVE=1;
    public File files; public final AssetManager assets=new AssetManager(); public String notification; public int releases;
    public void onCreate() {} public IBinder onBind(Intent intent) { return null; } public int onStartCommand(Intent intent,int flags,int startId) { return 0; } public void onDestroy() {}
    public <T> T getSystemService(Class<T> type) { return type.cast(new NotificationManager()); }
    public AssetManager getAssets() { return assets; } public File getFilesDir() { return files; } public File getCacheDir() { return files; } public ApplicationInfo getApplicationInfo() { return new ApplicationInfo(); }
    public void startForeground(int id, Notification value) { notification=value.text; } public void startForeground(int id,Notification value,int type) { startForeground(id,value); }
    public void stopForeground(int flags) { notification=null; releases++; } public void stopSelf() {}
}
