plugins { id("com.android.application") }

android {
    namespace = "app.nexttavern.android.mobile"
    compileSdk = 36
    buildToolsVersion = "36.0.0"
    defaultConfig {
        applicationId = "app.nexttavern.android"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.0.1-mobile-dev"
        resValue("string", "app_name", "NextTavern Mobile 开发版")
    }
    flavorDimensions += "runtime"
    productFlavors {
        create("arm64") {
            dimension = "runtime"
            ndk { abiFilters += "arm64-v8a" }
        }
        create("x86Diagnostic") {
            dimension = "runtime"
            applicationIdSuffix = ".x86diagnostic"
            versionNameSuffix = "-x86-diagnostic"
            ndk { abiFilters += "x86_64" }
            resValue("string", "app_name", "NextTavern Mobile x86诊断")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { buildConfig = true }
    buildTypes {
        debug { applicationIdSuffix = ".debug"; versionNameSuffix = "-debug" }
        release { isMinifyEnabled = false; isDebuggable = false }
    }
    packaging { jniLibs { useLegacyPackaging = true } }
    androidResources { noCompress += "zip" }
    sourceSets.getByName("main").jniLibs.srcDir("../app/src/main/jniLibs")
    sourceSets.getByName("main").assets.srcDir("../app/src/main/assets/runtime-notices")
}

val verifyMobileAssets by tasks.registering {
    doLast {
        check(file("src/main/assets/host.zip").isFile && file("src/main/assets/host-version.txt").isFile) {
            "BLOCKED: prepare the real host.zip and SHA256 host-version.txt before packaging."
        }
    }
}
tasks.matching { it.name.startsWith("package") && !it.name.endsWith("Resources") }
    .configureEach { dependsOn(verifyMobileAssets) }
for ((flavor, abi) in listOf("Arm64" to "arm64-v8a", "X86Diagnostic" to "x86_64")) {
    val verifyRuntime = tasks.register("verify${flavor}MobileRuntime") {
        doLast {
            for (name in listOf("libnexttavern_node.so", "libnexttavern_flock.so", "libnexttavern_require_builtin.so")) {
                check(file("../app/src/main/jniLibs/$abi/$name").isFile) {
                    "BLOCKED: missing installer-extracted $abi native runtime input $name"
                }
            }
        }
    }
    tasks.matching { it.name.startsWith("merge$flavor") && it.name.endsWith("NativeLibs") }
        .configureEach { dependsOn(verifyRuntime) }
}
