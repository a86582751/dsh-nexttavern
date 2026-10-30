package app.nexttavern.android.mobile.core;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public final class MobileCoreTest {
    private static int assertions;
    public static void main(String[] args) throws Exception {
        OriginPolicy origin = OriginPolicy.fromReadyUrl("http://127.0.0.1:23456/?token=fixture#roleplay");
        check(origin.contains("http://127.0.0.1:23456/assets/client.js"), "allow current origin subresources");
        check(!origin.contains("http://127.0.0.1:23457/"), "restart's old/different port is not same origin");
        check(!origin.contains("https://127.0.0.1:23456/"), "scheme belongs to the origin");
        check(!origin.contains("https://example.com/"), "external browser origin is not embedded");
        boolean rejected = false;
        try { OriginPolicy.fromReadyUrl("http://localhost:23456/"); } catch (IllegalArgumentException expected) { rejected = true; }
        check(rejected, "only explicit owned IPv4 loopback READY is accepted");
        File root = Files.createTempDirectory("nexttavern-mobile-core-").toFile();
        try {
            File workspace = new File(root, "workspace"); check(workspace.mkdir(), "create story fixture");
            File story = new File(workspace, "story.txt"); Files.write(story.toPath(), "saved story".getBytes(StandardCharsets.UTF_8));
            File parent = new File(root, "code");
            String first = repeat('a'); String second = repeat('b');
            File code = CodeBundle.install(parent, first, bundle("host-launch.mjs", "first"), () -> false);
            check(new File(code, ".complete").isFile(), "complete version is activated");
            check(new String(Files.readAllBytes(new File(code, ".complete").toPath()), StandardCharsets.US_ASCII)
                .contains("\"schemaVersion\":1"), "durable completion marker records schema one");
            check(Files.readAllBytes(new File(code, "host-launch.mjs").toPath()).length == 5, "code bytes extracted");
            InputStream unread = new InputStream() { @Override public int read() { throw new AssertionError("Cached bundle must not scan ZIP"); } };
            check(CodeBundle.install(parent, first, unread, () -> false).equals(code), "same version reused without reading archive");
            File upgrade = CodeBundle.install(parent, second, bundle("host-launch.mjs", "second"), () -> false);
            check(!upgrade.equals(code) && new File(code, ".complete").isFile(), "new version has separate code identity");
            check(new String(Files.readAllBytes(story.toPath()), StandardCharsets.UTF_8).equals("saved story"), "upgrade preserves persistent story");
            boolean cancelled = false;
            try { CodeBundle.install(parent, repeat('c'), bundle("host-launch.mjs", "cancel"), () -> true); }
            catch (IOException expected) { cancelled = true; }
            check(cancelled && !new File(parent, repeat('c')).exists(), "stop during install never activates partial code");
            check(!new File(parent, ".install-" + repeat('c')).exists(), "cancelled staging cleaned");
            boolean incomplete = false;
            try { CodeBundle.install(parent, repeat('d'), bundle("other.mjs", "missing entry"), () -> false); }
            catch (IOException expected) { incomplete = true; }
            check(incomplete && !new File(parent, repeat('d')).exists(), "incomplete bundle is not activated");
            for (String name : new String[] {"../../workspace/story.txt", story.getAbsolutePath(), ".", "../.install-" + repeat('e') + "-sibling/file"}) {
                boolean escaped = false;
                try { CodeBundle.install(parent, repeat('e'), bundle(name, "must not overwrite"), () -> false); }
                catch (IOException expected) { escaped = true; }
                check(escaped && !new File(parent, repeat('e')).exists(), "lexical containment rejects archive escape/root: " + name);
                check(new String(Files.readAllBytes(story.toPath()), StandardCharsets.UTF_8).equals("saved story"),
                    "rejected archive preserves persistent story");
            }
        } finally { remove(root); }
        System.out.println("PASS: " + assertions + " mobile core assertions; no Android/Host execution claim");
    }
    private static InputStream bundle(String entry, String value) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry(entry)); zip.write(value.getBytes(StandardCharsets.UTF_8)); zip.closeEntry();
        }
        return new ByteArrayInputStream(bytes.toByteArray());
    }
    private static String repeat(char value) { char[] bytes = new char[64]; java.util.Arrays.fill(bytes, value); return new String(bytes); }
    private static void remove(File file) throws IOException {
        File[] children = file.listFiles(); if (children != null) for (File child : children) remove(child);
        if (!file.delete()) throw new IOException("Cannot clean test fixture");
    }
    private static void check(boolean value, String label) { assertions++; if (!value) throw new AssertionError(label); }
}
