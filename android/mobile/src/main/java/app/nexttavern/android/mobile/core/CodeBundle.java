package app.nexttavern.android.mobile.core;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.function.BooleanSupplier;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Versioned immutable app code; persistent home/workspace are never extraction targets. */
public final class CodeBundle {
    private CodeBundle() {}
    public static File install(File codeParent, String version, InputStream source,
        BooleanSupplier cancelled) throws IOException {
        File target = new File(codeParent, version);
        try (InputStream input = source) {
            // The packaged SHA256 version is the producer's identity contract.
            // Reusing a complete version avoids scanning/copying the host at every start.
            if (new File(target, ".complete").isFile()) return target;
            if (!codeParent.isDirectory() && !codeParent.mkdirs()) throw new IOException("Cannot create code directory");
            File staging = new File(codeParent, ".install-" + version);
            remove(staging);
            if (!staging.mkdir()) throw new IOException("Cannot create code staging directory");
            try {
                // This fresh app-owned staging tree has no symlinks; extraction
                // creates only regular files/directories. Resolve the trusted
                // parent once, then enforce traversal containment lexically.
                Path root = staging.getCanonicalFile().toPath();
                File lastParent = null;
                // AssetManager reads cross JNI. Buffer compressed bytes too,
                // rather than making Inflater's tiny reads cross it repeatedly.
                try (ZipInputStream zip = new ZipInputStream(new BufferedInputStream(input, 64 * 1024))) {
                    ZipEntry entry;
                    byte[] buffer = new byte[16384];
                    while ((entry = zip.getNextEntry()) != null) {
                        if (cancelled.getAsBoolean()) throw new IOException("START_CANCELLED");
                        Path resolved = root.resolve(entry.getName()).normalize();
                        if (resolved.equals(root) || !resolved.startsWith(root)) throw new IOException("Invalid code archive path");
                        File file = resolved.toFile();
                        if (entry.isDirectory()) {
                            if (!file.isDirectory() && !file.mkdirs()) throw new IOException("Cannot create code subdirectory");
                        } else {
                            File parent = file.getParentFile();
                            if (!parent.equals(lastParent)) {
                                if (!parent.isDirectory() && !parent.mkdirs()) throw new IOException("Cannot create code parent");
                                lastParent = parent;
                            }
                            try (FileOutputStream out = new FileOutputStream(file)) {
                                int count;
                                while ((count = zip.read(buffer)) != -1) {
                                    if (cancelled.getAsBoolean()) throw new IOException("START_CANCELLED");
                                    out.write(buffer, 0, count);
                                }
                            }
                        }
                        zip.closeEntry();
                    }
                }
                if (!new File(staging, "host-launch.mjs").isFile()) throw new IOException("Host entry is absent");
                try (FileOutputStream marker = new FileOutputStream(new File(staging, ".complete"))) {
                    marker.write(("{\"schemaVersion\":1,\"hostVersion\":\"" + version + "\"}\n")
                        .getBytes(java.nio.charset.StandardCharsets.US_ASCII));
                    marker.getFD().sync();
                }
                remove(target); // Only an incomplete same-version code directory, never user data.
                if (!staging.renameTo(target)) throw new IOException("Cannot activate complete code bundle");
                return target;
            } catch (IOException | RuntimeException error) {
                remove(staging);
                throw error;
            }
        }
    }
    private static void remove(File file) throws IOException {
        File[] children = file.listFiles();
        if (children != null) for (File child : children) remove(child);
        if (file.exists() && !file.delete()) throw new IOException("Cannot remove incomplete code");
    }
}
