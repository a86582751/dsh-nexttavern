plugins { id("com.android.application") }

android {
    namespace = "app.nexttavern.android.mobile"
    compileSdk = 36
    buildToolsVersion = "36.0.0"
    defaultConfig {
        // Keep versionCode monotonic across public ARM64 builds; the earlier
        // internal mobile preview used 1. Never reuse a published code.
        applicationId = "app.nexttavern.android"
        minSdk = 30
        targetSdk = 36
        versionCode = 4
        versionName = "0.3.0-rc.2"
        resValue("string", "app_name", "NextTavern Mobile 预览版")
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

// Reuse the site's launcher artwork so the two surfaces cannot drift.
abstract class GenerateLauncherIcon : DefaultTask() {
    @get:InputFile
    @get:PathSensitive(PathSensitivity.NONE)
    abstract val brandMark: RegularFileProperty

    @get:OutputDirectory
    abstract val outputDirectory: DirectoryProperty

    @TaskAction
    fun generate() {
        val icon = outputDirectory.file("mipmap-nodpi/ic_launcher.webp").get().asFile
        icon.parentFile.mkdirs()
        brandMark.get().asFile.copyTo(icon, overwrite = true)
    }
}

androidComponents.onVariants { variant ->
    val launcherIcon = tasks.register<GenerateLauncherIcon>("generate${variant.name.replaceFirstChar { it.uppercaseChar() }}LauncherIcon") {
        brandMark.set(rootProject.layout.projectDirectory.file("../site/art/brand-mark.webp"))
        outputDirectory.set(layout.buildDirectory.dir("generated/launcher-icon/${variant.name}"))
    }
    variant.sources.res?.addGeneratedSourceDirectory(launcherIcon, GenerateLauncherIcon::outputDirectory)
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
