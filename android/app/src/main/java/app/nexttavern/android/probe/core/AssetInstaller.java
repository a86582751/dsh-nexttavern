package app.nexttavern.android.probe.core;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.UUID;

/** A complete script bundle becomes visible only after a same-filesystem rename. */
public final class AssetInstaller {
    public interface Source {
        String[] list(String path) throws IOException;
        InputStream open(String path) throws IOException;
    }
    private static final long MAX_BYTES = 4L * 1024 * 1024;
    private final Source source;
    private long bytes;
    private int files;
    public AssetInstaller(Source source) { this.source = source; }

    public File install(File filesDir) throws IOException {
        File parent = ProbePaths.privateDirectory(filesDir, "probe-bundles");
        String id = UUID.randomUUID().toString();
        File staging = new File(parent, ".stage-" + id);
        File complete = new File(parent, "bundle-" + id);
        if (!staging.mkdir()) throw new IOException("Cannot create probe staging directory");
        bytes = 0;
        files = 0;
        try {
            // Source is the APK assets root, already filtered to scripts and test fixtures.
            copyDirectory("", staging, 0);
            if (!new File(staging, "run.mts").isFile()) throw new IOException("Bundled run.mts is absent");
            if (Thread.currentThread().isInterrupted()) throw new IOException("Asset copy interrupted");
            if (!staging.renameTo(complete)) throw new IOException("Cannot activate complete probe bundle");
            return complete;
        } catch (IOException | RuntimeException error) {
            remove(staging);
            throw error;
        }
    }

    private void copyDirectory(String asset, File target, int depth) throws IOException {
        if (depth > 8) throw new IOException("Probe asset nesting exceeds limit");
        for (String name : source.list(asset)) {
            if (!name.matches("[a-zA-Z0-9][a-zA-Z0-9._-]*")) throw new IOException("Unsafe asset name");
            if (Thread.currentThread().isInterrupted()) throw new IOException("Asset copy interrupted");
            String path = asset.isEmpty() ? name : asset + "/" + name;
            File output = new File(target, name);
            String[] children = source.list(path);
            if (children.length > 0) {
                if (!output.mkdir()) throw new IOException("Cannot create asset directory");
                copyDirectory(path, output, depth + 1);
            } else {
                if (++files > 256) throw new IOException("Too many probe assets");
                try (InputStream input = source.open(path); FileOutputStream stream = new FileOutputStream(output)) {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = input.read(buffer)) != -1) {
                        bytes += read;
                        if (bytes > MAX_BYTES) throw new IOException("Probe assets exceed size limit");
                        if (Thread.currentThread().isInterrupted()) throw new IOException("Asset copy interrupted");
                        stream.write(buffer, 0, read);
                    }
                    stream.getFD().sync();
                }
                // No chmod/setExecutable: these files are never native executables.
            }
        }
    }

    public static void remove(File path) throws IOException {
        if (java.nio.file.Files.isSymbolicLink(path.toPath())) {
            if (!path.delete()) throw new IOException("Cannot remove symlink " + path);
            return;
        }
        File[] children = path.listFiles();
        if (children != null) for (File child : children) remove(child);
        if (path.exists() && !path.delete()) throw new IOException("Cannot remove " + path);
    }
}
