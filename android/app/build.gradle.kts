import java.security.MessageDigest

plugins { id("com.android.application") }

// Explicit ephemeral KVM diagnostic only; default APK target remains arm64.
val probeAbi = providers.gradleProperty("nexttavernProbeAbi").orElse("arm64-v8a").get()
check(probeAbi in setOf("arm64-v8a", "x86_64")) { "nexttavernProbeAbi must be arm64-v8a or x86_64" }
val kvmDiagnostic = probeAbi == "x86_64"
val runtimeCache = if (kvmDiagnostic) "runtime-inputs-x64" else "runtime-inputs"
val probeCa = file("../artifacts/$runtimeCache/extracted/ca-certificates/data/data/com.termux/files/usr/etc/tls/cert.pem")

android {
    namespace = "app.nexttavern.android.probe"
    compileSdk = 36
    buildToolsVersion = "36.0.0"
    defaultConfig {
        applicationId = "app.nexttavern.android.probe" + if (kvmDiagnostic) ".x86kvm" else ""
        minSdk = 26 // Provisional runtime probe floor; not an accepted product minimum.
        targetSdk = 36
        versionCode = 1
        versionName = "0.0.1-g0-probe" + if (kvmDiagnostic) "-x86-kvm-diagnostic" else ""
        buildConfigField("boolean", "PROBE_KVM_DIAGNOSTIC", kvmDiagnostic.toString())
        ndk { abiFilters += probeAbi }
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
    from(probeCa) { into("certs"); rename { "ca-certificates.pem" } }
    into(layout.buildDirectory.dir("generated/probeAssets/probe"))
}
tasks.named("preBuild") { dependsOn(stageProbeAssets) }

val verifyBundledNode by tasks.registering {
    group = "verification"
    description = "Reject APK packaging without the selected Android Node runtime and locked public CA."
    dependsOn(stageProbeAssets)
    doLast {
        val runtime = file("src/main/jniLibs/$probeAbi/libnexttavern_node.so")
        check(runtime.isFile && runtime.length() > 0) {
            "BLOCKED: missing Android $probeAbi Node 24 runtime: ${runtime.path}. " +
                "Supply an audited Android executable; desktop Node is not valid APK evidence."
        }
        val ca = layout.buildDirectory.file("generated/probeAssets/probe/certs/ca-certificates.pem").get().asFile
        check(ca.isFile) { "BLOCKED: prepare the existing locked Termux CA input with prepare-runtime.mts" }
        val digest = MessageDigest.getInstance("SHA-256").digest(ca.readBytes())
            .joinToString("") { "%02x".format(it.toInt() and 0xff) }
        check(digest == "796f1389bfea13c0ed78f663b765baaff54a508e5483786bd6ece73c5e3e3cbe") {
            "BLOCKED: probe CA differs from the locked certificate set used by mobile"
        }
    }
}
// Compile/test can run without a runtime; every APK package path is gated.
tasks.matching { it.name.startsWith("merge") && it.name.endsWith("NativeLibs") }
    .configureEach { dependsOn(verifyBundledNode) }
