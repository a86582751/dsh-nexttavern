package android.app;
public class Notification {
    public String text;
    public static class Builder { private final Notification value=new Notification(); public Builder(Object c,String channel) {} public Builder setSmallIcon(int icon) {return this;} public Builder setContentTitle(String s) {return this;} public Builder setContentText(String s) {value.text=s;return this;} public Builder setContentIntent(PendingIntent i) {return this;} public Builder setOngoing(boolean b) {return this;} public Builder addAction(Action a) {return this;} public Notification build() {return value;} }
    public static class Action { public static class Builder { public Builder(Object icon,String title,PendingIntent i) {} public Action build() {return new Action();} } }
}
