#!/usr/bin/env bash
set -euo pipefail
module="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
classes="$module/build/core-test-classes"
mkdir -p "$classes"
find "$classes" -type f -delete
mapfile -t sources < <(find "$module/src/main/java/app/nexttavern/android/mobile/core" "$module/src/test/java" -name '*.java' -print | sort)
"${JAVAC:-javac}" --release 8 -Xlint:all,-options -Werror -d "$classes" "${sources[@]}"
"${JAVA:-java}" -ea -cp "$classes" app.nexttavern.android.mobile.core.MobileCoreTest
