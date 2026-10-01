// Generated from runtime/alpha3/compat/presets/src/index.ts; edit the TypeScript source.
export const roleplayPreset = {
    id: 'roleplay',
    name: 'NextTavern',
    description: '沉浸式长篇小说角色扮演工作台',
    plugins: [{ id: 'nexttavern-roleplay-composition', name: 'dsh-nexttavern-presets/composition' }],
};
// Row ID is the user's overlay target; config.id is the durable Session
// identity. Keep both stable across package moves, upgrades and reinstalls.
export const roleplayPresetEntry = {
    id: 'preset-roleplay',
    name: '@deepseek-ai/dsh-agent-preset',
    config: roleplayPreset,
};
