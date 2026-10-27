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

/** One read-only public accessibility snapshot; no product instrumentation or actions. */
public final class HierarchyInstrumentation extends Instrumentation {
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
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
            // Connection readiness does not imply a root is already available.
            // Reuse this session; retry only empty root reads, never exceptions.
            long deadline = SystemClock.uptimeMillis() + 3000;
            do {
                phase = "ROOT_READ";
                StringBuilder xml = new StringBuilder("<hierarchy>");
                int roots = 0;
                for (AccessibilityWindowInfo window : ui.getWindows()) {
                    try {
                        AccessibilityNodeInfo root = window.getRoot();
                        if (root != null) {
                            phase = "SERIALIZE";
                            node(xml, root, window);
                            roots++;
                            phase = "ROOT_READ";
                        }
                    } finally { window.recycle(); }
                }
                if (roots == 0) {
                    AccessibilityNodeInfo root = ui.getRootInActiveWindow();
                    if (root != null) { phase = "SERIALIZE"; node(xml, root, null); roots++; }
                }
                if (roots > 0) {
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
