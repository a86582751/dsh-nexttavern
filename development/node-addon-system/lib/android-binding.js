// Generated from runtime/alpha3/compat/node-addon-system/src/android-binding.ts; edit the TypeScript source.
let binding;
export function loadAndroidBinding() {
    if (binding)
        return binding;
    const path = process.env.NEXTTAVERN_FLOCK_ADDON;
    if (!path)
        throw new Error('Android system primitives requires NEXTTAVERN_FLOCK_ADDON from the native supervisor');
    const native = { exports: {} };
    process.dlopen(native, path);
    binding = native.exports;
    return binding;
}
