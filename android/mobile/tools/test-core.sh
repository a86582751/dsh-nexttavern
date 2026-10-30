#!/usr/bin/env bash
set -euo pipefail
module="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
classes="$module/build/core-test-classes"
mkdir -p "$classes"
find "$classes" -type f -delete
mapfile -t sources < <(find "$module/src/main/java/app/nexttavern/android/mobile/core" "$module/src/test/java" -name '*.java' -print | sort)
"${JAVAC:-javac}" --release 8 -Xlint:all,-options -Werror -d "$classes" "${sources[@]}"
"${JAVA:-java}" -ea -cp "$classes" app.nexttavern.android.mobile.core.MobileCoreTest
# Compile the actual service separately with platform/process boundary doubles.
# This proves lifecycle scheduling, not Android foreground-service or native behavior.
runtime_classes="$module/build/runtime-test-classes"
mkdir -p "$runtime_classes"
find "$runtime_classes" -type f -delete
mapfile -t runtime_sources < <(find "$module/src/testRuntime/java" -name '*.java' -print | sort)
"${JAVAC:-javac}" --release 8 -Xlint:all,-options -Werror -cp "$classes" -d "$runtime_classes" \
  "$module/src/main/java/app/nexttavern/android/mobile/RuntimeService.java" "${runtime_sources[@]}"
"${JAVA:-java}" -ea -cp "$runtime_classes:$classes" app.nexttavern.android.mobile.RuntimeServiceTest
