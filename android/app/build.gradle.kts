plugins { id("com.android.application") }

android {
    namespace = "app.nexttavern.android.probe"
    compileSdk = 36
    buildToolsVersion = "36.0.0"
    defaultConfig {
        applicationId = "app.nexttavern.android.probe"
        minSdk = 26 // Provisional runtime probe floor; not an accepted product minimum.
        targetSdk = 36
        versionCode = 1
        versionName = "0.0.1-g0-probe"
        ndk { abiFilters += "arm64-v8a" }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { buildConfig = true }
    buildTypes {
        debug { applicationIdSuffix = ".debug"; versionNameSuffix = "-debug" }
        release {
            isMinifyEnabled = false
            isDebuggable = false
            // Intentionally unsigned: debug signing is not release evidence.
        }
    }
    packaging { jniLibs { useLegacyPackaging = true } }
    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/probeAssets"))
}

val stageProbeAssets by tasks.registering(Sync::class) {
    from("../probe") { include("*.mts", "fixtures/**") }
    into(layout.buildDirectory.dir("generated/probeAssets/probe"))
}
tasks.named("preBuild") { dependsOn(stageProbeAssets) }

val verifyBundledNode by tasks.registering {
    group = "verification"
    description = "Reject APK packaging without the Android arm64 Node runtime."
    doLast {
        val runtime = file("src/main/jniLibs/arm64-v8a/libnexttavern_node.so")
        check(runtime.isFile && runtime.length() > 0) {
            "BLOCKED: missing Android arm64 Node 24 runtime: ${runtime.path}. " +
                "Supply an audited Android executable; desktop Node is not valid APK evidence."
        }
    }
}
// Compile/test can run without a runtime; every APK package path is gated.
tasks.matching { it.name.startsWith("merge") && it.name.endsWith("NativeLibs") }
    .configureEach { dependsOn(verifyBundledNode) }
