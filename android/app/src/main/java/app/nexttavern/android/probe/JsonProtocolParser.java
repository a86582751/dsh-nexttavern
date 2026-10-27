package app.nexttavern.android.probe;

import app.nexttavern.android.probe.core.ProcessSupervisor;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

/** Android's built-in JSON decoder; no WebView, JS bridge or third-party parser. */
final class JsonProtocolParser implements ProcessSupervisor.Parser {
    @Override public ProcessSupervisor.Record parse(String line) {
        if (!line.trim().startsWith("{")) return null; // Node diagnostics are not readiness evidence.
        try {
            JSONTokener decoder = new JSONTokener(line);
            Object decoded = decoder.nextValue();
            if (!(decoded instanceof JSONObject) || decoder.nextClean() != 0) {
                throw new IllegalArgumentException("Protocol line must be exactly one JSON object");
            }
            JSONObject value = (JSONObject) decoded;
            if (!"nexttavern-g0".equals(value.opt("protocol"))) return null;
            String event = string(value, "event");
            if ("ready".equals(event) || "check".equals(event)) {
                return new ProcessSupervisor.Record(event, "", false, "", "");
            }
            if (!"result".equals(event)) throw new IllegalArgumentException("Unknown protocol event");
            String status = string(value, "status");
            if (!"passed".equals(status) && !"failed".equals(status) && !"blocked".equals(status)) {
                throw new IllegalArgumentException("Invalid result status");
            }
            Object ok = value.get("ok");
            if (!(ok instanceof Boolean)) throw new IllegalArgumentException("Result ok must be boolean");
            if (!Boolean.FALSE.equals(value.get("androidGate"))) {
                throw new IllegalArgumentException("Capability record cannot accept the full Android gate");
            }
            String summary = String.valueOf(value.get("summary"));
            if (summary.length() > 2048) summary = summary.substring(0, 2048) + "…";
            return new ProcessSupervisor.Record(event, status, (Boolean) ok,
                string(value, "actualPlatform"), summary);
        } catch (JSONException error) {
            throw new IllegalArgumentException("Malformed protocol JSON", error);
        }
    }
    private static String string(JSONObject value, String name) throws JSONException {
        Object item = value.get(name);
        if (!(item instanceof String)) throw new IllegalArgumentException(name + " must be string");
        return (String) item;
    }
}
