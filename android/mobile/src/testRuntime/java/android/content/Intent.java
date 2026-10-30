package android.content;
public class Intent { private String action; public Intent() {} public Intent(Object context, Class<?> target) {} public Intent setAction(String value) { action=value; return this; } public String getAction() { return action; } }
