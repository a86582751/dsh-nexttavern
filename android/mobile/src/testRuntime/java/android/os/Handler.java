package android.os;
import java.util.ArrayDeque;
public class Handler {
    private static final ArrayDeque<Runnable> tasks = new ArrayDeque<>();
    public Handler(Looper looper) {}
    public boolean post(Runnable task) { tasks.add(task); return true; }
    public static void next() { tasks.remove().run(); }
    public static void drain() { while (!tasks.isEmpty()) tasks.remove().run(); }
}
