#!/usr/bin/env bash
set -euo pipefail
app="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
classes="$app/build/core-test-classes"
javac="${JAVAC:-javac}"
java="${JAVA:-java}"
command -v "$javac" >/dev/null || { printf '%s\n' 'BLOCKED: javac unavailable; point JAVAC and JAVA at a JDK 17+.' >&2; exit 2; }
mkdir -p "$classes"
find "$classes" -type f -delete
mapfile -t sources < <(find "$app/src/main/java/app/nexttavern/android/probe/core" "$app/src/test/java" -name '*.java' -print | sort)
"$javac" --release 8 -Xlint:all,-options -Werror -d "$classes" "${sources[@]}"
"$java" -ea -cp "$classes" app.nexttavern.android.probe.core.CoreTest "$@"
