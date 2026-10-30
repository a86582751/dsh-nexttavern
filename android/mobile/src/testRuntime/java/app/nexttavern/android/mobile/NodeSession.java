package app.nexttavern.android.mobile;
import app.nexttavern.android.mobile.core.OriginPolicy; import java.io.*;
// Process-boundary double only: all lifecycle coordination is the production service.
final class NodeSession {
    interface Events { void ready(NodeSession owner,String url,String version,OriginPolicy origin); void error(NodeSession owner,String code); void stopped(NodeSession owner); void exited(NodeSession owner,int exit); }
    static NodeSession latest; static Runnable constructing;
    final Events events; final String generation; int stops, terminations, forces;
    NodeSession(File nativeDirectory,File code,File data,File home,File workspace,File memory,File tmp,String generation,Events events,File diagnostic) {
        this.events=events; this.generation=generation; latest=this;
        if(constructing!=null) constructing.run();
    }
    void observe() {} void stop() throws IOException { stops++; } void terminate() { terminations++; } void forceDestroy() { forces++; }
    void ready() { String url="http://127.0.0.1:23456/?token=fixture"; events.ready(this,url,"fixture",OriginPolicy.fromReadyUrl(url)); }
}
