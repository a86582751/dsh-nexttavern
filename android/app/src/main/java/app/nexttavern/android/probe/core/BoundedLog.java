package app.nexttavern.android.probe.core;

import java.util.ArrayDeque;

/** Bounded by both lines and characters, independent of subprocess behavior. */
public final class BoundedLog {
    private final int maxLines;
    private final int maxCharacters;
    private final ArrayDeque<String> lines = new ArrayDeque<>();
    private int characters;
    private long discarded;
    public BoundedLog(int maxLines, int maxCharacters) {
        if (maxLines < 1 || maxCharacters < 1) throw new IllegalArgumentException("Positive bounds required");
        this.maxLines = maxLines;
        this.maxCharacters = maxCharacters;
    }
    public synchronized void append(String line) {
        if (line.length() > maxCharacters) line = line.substring(0, maxCharacters);
        lines.addLast(line);
        characters += line.length();
        while (lines.size() > maxLines || characters > maxCharacters) {
            characters -= lines.removeFirst().length();
            discarded++;
        }
    }
    public synchronized String text() {
        StringBuilder result = new StringBuilder();
        if (discarded > 0) result.append("[older lines omitted: ").append(discarded).append("]\n");
        for (String line : lines) result.append(line).append('\n');
        return result.toString();
    }
}
