package app.nexttavern.qa.ui;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Activity;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.HashSet;
import java.util.Set;

/** Read-only snapshots; explicit semantic focus/show operations for the QA app only. */
public final class HierarchyInstrumentation extends Instrumentation {
    private Bundle request;
    @Override public void onCreate(Bundle arguments) {
        request = arguments == null ? new Bundle() : new Bundle(arguments);
        super.onCreate(arguments); start();
    }
    @Override public void onStart() {
        Bundle result = new Bundle();
        String phase = "AUTOMATION_CONNECT";
        try {
            UiAutomation ui = getUiAutomation();
            if (ui == null) { failure("AUTOMATION_UNAVAILABLE", null); return; }
            phase = "SERVICE_INFO";
            AccessibilityServiceInfo info = ui.getServiceInfo();
            if (info == null) { failure("SERVICE_INFO_UNAVAILABLE", null); return; }
            info.flags |= AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
                | AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
            ui.setServiceInfo(info);
            String operation = request.getString("operation", "");
            if (!operation.isEmpty()) {
                boolean show = "show-control".equals(operation);
                if (!show && !"focus-input".equals(operation)) { failure("OPERATION_NOT_ALLOWED", null); return; }
                phase = show ? "SHOW_CONTROL" : "FOCUS_INPUT";
                controlAction(ui, show);
                return;
            }
            // Connection readiness does not imply a root is already available.
            // Reuse this session; a non-active system root alone is not ready.
            // Retry missing active/focused content only, never exceptions.
            long deadline = SystemClock.uptimeMillis() + 3000;
            do {
                phase = "ROOT_READ";
                StringBuilder xml = new StringBuilder("<hierarchy>");
                boolean activeRoot = false;
                Set<Integer> rootIds = new HashSet<>();
                for (AccessibilityWindowInfo window : ui.getWindows()) {
                    try {
                        AccessibilityNodeInfo root = window.getRoot();
                        if (root != null) {
                            phase = "SERIALIZE";
                            activeRoot |= window.isActive() || window.isFocused();
                            if (rootIds.add(root.getWindowId())) node(xml, root, window);
                            else root.recycle();
                            phase = "ROOT_READ";
                        }
                    } finally { window.recycle(); }
                }
                if (!activeRoot) {
                    AccessibilityNodeInfo root = ui.getRootInActiveWindow();
                    if (root != null) {
                        activeRoot = true; // This public getter identifies the active window.
                        if (rootIds.add(root.getWindowId())) { phase = "SERIALIZE"; node(xml, root, null); }
                        else root.recycle(); // Already serialized via getWindows().
                    }
                }
                if (activeRoot) {
                    xml.append("</hierarchy>");
                    if (xml.length() > 350000) throw new IllegalStateException("HIERARCHY_TOO_LARGE");
                    result.putString("hierarchy", xml.toString());
                    phase = "FINISH";
                    finish(Activity.RESULT_OK, result);
                    return;
                }
                if (SystemClock.uptimeMillis() >= deadline) break;
                SystemClock.sleep(200);
            } while (SystemClock.uptimeMillis() < deadline);
            failure("ROOTS_NOT_READY", null);
        } catch (RuntimeException error) {
            String reason = error instanceof IllegalStateException && "HIERARCHY_TOO_LARGE".equals(error.getMessage())
                ? "HIERARCHY_TOO_LARGE" : "HIERARCHY_" + phase + "_FAILED";
            failure(reason, error);
        }
    }
    private void controlAction(UiAutomation ui, boolean show) {
        String targetPackage = request.getString("targetPackage");
        String targetClass = show ? request.getString("targetClass") : "android.widget.EditText";
        String hint = request.getString("targetHint");
        String description = request.getString("targetDescription");
        boolean editable = "android.widget.EditText".equals(targetClass);
        String targetText = show && !editable ? request.getString("targetText") : null;
        String prefix = show ? "SHOW" : "FOCUS";
        if (!"app.nexttavern.android.x86diagnostic".equals(targetPackage) || targetClass == null
            || targetClass.isEmpty() || hint == null || description == null || show && !editable && targetText == null) {
            if (show) {
                Bundle invalid = new Bundle();
                invalid.putInt("matchCount", 0); invalid.putBoolean("supported", false); invalid.putBoolean("accepted", false);
                invalid.putString("error", "SHOW_REQUEST_INVALID");
                finish(Activity.RESULT_CANCELED, invalid);
            } else failure("FOCUS_REQUEST_INVALID", null);
            return;
        }
        List<AccessibilityNodeInfo> matches = new ArrayList<>();
        Set<Integer> rootIds = new HashSet<>();
        boolean appRoot = false;
        try {
            long deadline = SystemClock.uptimeMillis() + 3000;
            do {
                rootIds.clear();
                for (AccessibilityWindowInfo window : ui.getWindows()) {
                    try {
                        if (!window.isActive() && !window.isFocused()) continue;
                        AccessibilityNodeInfo root = window.getRoot();
                        if (root == null) continue;
                        if (targetPackage.contentEquals(text(root.getPackageName())) && rootIds.add(root.getWindowId())) {
                            appRoot = true;
                            findControls(root, targetPackage, targetClass, hint, description, targetText, show, matches);
                        } else root.recycle();
                    } finally { window.recycle(); }
                }
                if (!appRoot) {
                    AccessibilityNodeInfo root = ui.getRootInActiveWindow();
                    if (root != null) {
                        if (targetPackage.contentEquals(text(root.getPackageName()))) {
                            appRoot = true;
                            findControls(root, targetPackage, targetClass, hint, description, targetText, show, matches);
                        } else root.recycle();
                    }
                }
                if (appRoot || SystemClock.uptimeMillis() >= deadline) break;
                SystemClock.sleep(200); // Root readiness only; never retry an action.
            } while (SystemClock.uptimeMillis() < deadline);
            Bundle result = new Bundle();
            result.putInt("matchCount", matches.size());
            if (show) result.putBoolean("supported", false);
            if (!appRoot || matches.size() != 1) {
                result.putBoolean("accepted", false);
                result.putString("error", !appRoot ? prefix + "_APP_ROOT_NOT_READY"
                    : matches.isEmpty() ? prefix + "_TARGET_NOT_FOUND" : prefix + "_TARGET_AMBIGUOUS");
                finish(Activity.RESULT_CANCELED, result);
                return;
            }
            AccessibilityNodeInfo target = matches.get(0);
            if (show) {
                boolean supported = false;
                for (AccessibilityNodeInfo.AccessibilityAction action : target.getActionList()) {
                    if (action.getId() == AccessibilityNodeInfo.AccessibilityAction.ACTION_SHOW_ON_SCREEN.getId()) supported = true;
                }
                result.putBoolean("supported", supported);
                if (!supported) {
                    result.putBoolean("accepted", false);
                    result.putString("error", "SHOW_ACTION_UNSUPPORTED");
                    finish(Activity.RESULT_CANCELED, result);
                    return;
                }
                boolean accepted = target.performAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SHOW_ON_SCREEN.getId());
                result.putBoolean("accepted", accepted);
                if (!accepted) result.putString("error", "SHOW_ACTION_REJECTED");
                finish(Activity.RESULT_OK, result);
                return;
            }
            // One explicit action only. Acceptance is not proof of resulting
            // focus: the caller must obtain a fresh hierarchy before typing.
            result.putBoolean("accepted", target.performAction(AccessibilityNodeInfo.ACTION_FOCUS));
            finish(Activity.RESULT_OK, result);
        } finally { for (AccessibilityNodeInfo match : matches) match.recycle(); }
    }
    private static String text(CharSequence value) { return value == null ? "" : value.toString(); }
    private static void findControls(AccessibilityNodeInfo node, String targetPackage, String targetClass, String hint,
                                    String description, String targetText, boolean show, List<AccessibilityNodeInfo> matches) {
        try {
            boolean editable = "android.widget.EditText".equals(targetClass);
            if (targetPackage.equals(text(node.getPackageName())) && targetClass.equals(text(node.getClassName()))
                && hint.equals(text(node.getHintText())) && description.equals(text(node.getContentDescription()))
                && node.isEnabled() && (show || node.isVisibleToUser())
                && (editable ? node.isEditable() : targetText.equals(text(node.getText())))) {
                matches.add(AccessibilityNodeInfo.obtain(node));
            }
            for (int i = 0; i < node.getChildCount(); i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) findControls(child, targetPackage, targetClass, hint, description, targetText, show, matches);
            }
        } finally { node.recycle(); }
    }
    private void failure(String reason, RuntimeException error) {
        Bundle result = new Bundle();
        result.putString("error", reason);
        if (error != null) {
            String type = error.getClass().getSimpleName();
            result.putString("exception", type.matches("[A-Za-z]{1,80}") ? type : "RuntimeException");
        }
        finish(Activity.RESULT_CANCELED, result); // No messages, stack traces or partial XML.
    }
    private static void node(StringBuilder xml, AccessibilityNodeInfo node, AccessibilityWindowInfo window) {
        try {
            xml.append("<node");
            attr(xml, "text", node.getText());
            attr(xml, "hint", node.getHintText());
            attr(xml, "resource-id", node.getViewIdResourceName());
            attr(xml, "class", node.getClassName());
            attr(xml, "package", node.getPackageName());
            attr(xml, "content-desc", node.getContentDescription());
            attr(xml, "checkable", node.isCheckable());
            attr(xml, "checked", node.isChecked());
            attr(xml, "clickable", node.isClickable());
            attr(xml, "enabled", node.isEnabled());
            attr(xml, "focusable", node.isFocusable());
            attr(xml, "focused", node.isFocused());
            attr(xml, "scrollable", node.isScrollable());
            attr(xml, "long-clickable", node.isLongClickable());
            attr(xml, "password", node.isPassword());
            attr(xml, "selected", node.isSelected());
            attr(xml, "visible-to-user", node.isVisibleToUser());
            Rect box = new Rect(); node.getBoundsInScreen(box);
            attr(xml, "bounds", "[" + box.left + "," + box.top + "][" + box.right + "," + box.bottom + "]");
            if (window != null) {
                attr(xml, "window-active", window.isActive());
                attr(xml, "window-focused", window.isFocused());
            }
            xml.append('>');
            for (int i = 0; i < node.getChildCount(); i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) node(xml, child, null);
            }
            xml.append("</node>");
            if (xml.length() > 350000) throw new IllegalStateException("HIERARCHY_TOO_LARGE");
        } finally { node.recycle(); }
    }
    private static void attr(StringBuilder xml, String name, Object value) {
        String text = value == null ? "" : value.toString();
        xml.append(' ').append(name).append("=\"").append(text.replace("&", "&amp;")
            .replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
            .replace("\r", "&#13;").replace("\n", "&#10;").replace("\t", "&#9;")).append('"');
    }
}
