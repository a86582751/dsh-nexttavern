package app.nexttavern.qa.ui;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Activity;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.graphics.Rect;
import android.os.Bundle;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;

/** One read-only public accessibility snapshot; no product instrumentation or actions. */
public final class HierarchyInstrumentation extends Instrumentation {
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            UiAutomation ui = getUiAutomation();
            AccessibilityServiceInfo info = ui.getServiceInfo();
            info.flags |= AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
                | AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS;
            ui.setServiceInfo(info);
            StringBuilder xml = new StringBuilder("<hierarchy>");
            int roots = 0;
            for (AccessibilityWindowInfo window : ui.getWindows()) {
                try {
                    AccessibilityNodeInfo root = window.getRoot();
                    if (root != null) {
                        node(xml, root, window);
                        roots++;
                    }
                } finally { window.recycle(); }
            }
            if (roots == 0) {
                AccessibilityNodeInfo root = ui.getRootInActiveWindow();
                if (root != null) { node(xml, root, null); roots++; }
            }
            if (roots == 0) throw new IllegalStateException();
            xml.append("</hierarchy>");
            // Fail explicitly, never truncate a hierarchy into misleading evidence.
            if (xml.length() > 350000) throw new IllegalStateException();
            result.putString("hierarchy", xml.toString());
            finish(Activity.RESULT_OK, result);
        } catch (RuntimeException error) {
            result.clear();
            result.putString("error", "HIERARCHY_READ_FAILED");
            finish(Activity.RESULT_CANCELED, result);
        }
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
            if (xml.length() > 350000) throw new IllegalStateException();
        } finally { node.recycle(); }
    }
    private static void attr(StringBuilder xml, String name, Object value) {
        String text = value == null ? "" : value.toString();
        xml.append(' ').append(name).append("=\"").append(text.replace("&", "&amp;")
            .replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
            .replace("\r", "&#13;").replace("\n", "&#10;").replace("\t", "&#9;")).append('"');
    }
}
