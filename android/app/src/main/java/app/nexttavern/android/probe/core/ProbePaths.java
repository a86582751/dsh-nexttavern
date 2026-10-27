package app.nexttavern.android.probe.core;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/** Launch contract: executable is installer-owned; writable files contain data/scripts only. */
public final class ProbePaths {
    public static final String RUNTIME_NAME = "libnexttavern_node.so";
    private ProbePaths() {}
    public static boolean softwareDiagnostic(String packageName) { return packageName.contains(".x86diagnostic"); }

    public static File runtime(File nativeLibraryDir) throws IOException {
        if (nativeLibraryDir == null) throw new IOException("Installer nativeLibraryDir is unavailable");
        File directory = nativeLibraryDir.getCanonicalFile();
        File file = new File(directory, RUNTIME_NAME);
        if (Files.isSymbolicLink(file.toPath()) || !file.getCanonicalFile().equals(file)) {
            throw new IOException("Runtime must be the installer-extracted file, not a symlink");
        }
        if (!file.isFile() || !file.canExecute()) {
            throw new IOException("BLOCKED: installer-extracted Android Node runtime is missing or not executable: " + file);
        }
        return file;
    }

    public static File privateDirectory(File filesDir, String child) throws IOException {
        if (!child.matches("[a-zA-Z0-9][a-zA-Z0-9._-]*")) throw new IOException("Invalid private directory name");
        File root = filesDir.getCanonicalFile();
        File directory = new File(root, child);
        if (Files.isSymbolicLink(directory.toPath())) throw new IOException("Private directory cannot be a symlink");
        if (!directory.isDirectory() && !directory.mkdirs()) throw new IOException("Cannot create " + directory);
        if (!directory.getCanonicalFile().equals(directory)) throw new IOException("Private directory escaped filesDir");
        return directory;
    }

    public static List<String> command(File runtime, File bundle) throws IOException {
        return command(runtime, bundle, false);
    }
    public static List<String> command(File runtime, File bundle, boolean softwareDiagnostic) throws IOException {
        return command(runtime, bundle, softwareDiagnostic, false);
    }
    public static List<String> command(File runtime, File bundle, boolean softwareDiagnostic, boolean httpsClient) throws IOException {
        return command(runtime, bundle, softwareDiagnostic, httpsClient, false);
    }
    public static List<String> command(File runtime, File bundle, boolean softwareDiagnostic, boolean httpsClient, boolean atomicPublish) throws IOException {
        File entry = new File(bundle.getCanonicalFile(), "run.mts");
        if (!entry.isFile() || Files.isSymbolicLink(entry.toPath())) throw new IOException("Probe run.mts is missing");
        List<String> command = new ArrayList<>(Arrays.asList(runtime.getAbsolutePath(), "--experimental-strip-types", entry.getAbsolutePath()));
        if (softwareDiagnostic) { command.add("--timeout-ms"); command.add("120000"); }
        if (httpsClient) {
            if (!new File(bundle, "certs/ca-certificates.pem").isFile()) throw new IOException("Locked public CA asset is missing");
            command.add("--https-client");
        }
        if (atomicPublish) command.add("--atomic-publish");
        return command;
    }
    public static long supervisorTimeoutSeconds(boolean softwareDiagnostic) { return softwareDiagnostic ? 1800 : 180; }
}
