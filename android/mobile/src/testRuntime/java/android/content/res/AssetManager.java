package android.content.res;
import java.io.*; import java.util.*;
public class AssetManager { public final Map<String, byte[]> assets = new HashMap<>(); public InputStream open(String name) throws IOException { byte[] bytes=assets.get(name); if(bytes==null) throw new IOException(name); return new ByteArrayInputStream(bytes); } }
