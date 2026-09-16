// Generated from runtime/alpha3/core/narrative-preset-catalog.ts; edit the TypeScript source.
import { LIGHT_NOVEL_TEXT } from './narrative-styles/light-novel.js';
import { OTOME_TEXT } from './narrative-styles/otome.js';
import { COSMIC_ROMANCE_TEXT } from './narrative-styles/cosmic-romance.js';
import { JRPG_TEXT } from './narrative-styles/jrpg.js';
import { CINEMATIC_TEXT } from './narrative-styles/cinematic.js';
import { ANNALISTIC_TEXT } from './narrative-styles/annalistic.js';
import { MINIMAL_TEXT } from './narrative-styles/minimal.js';
import { DELICATE_TEXT } from './narrative-styles/delicate.js';
import { FANTASY_TEXT } from './narrative-styles/fantasy.js';
import { HORROR_TEXT } from './narrative-styles/horror.js';
import { LUXUN_TEXT } from './narrative-styles/luxun.js';
import { LYRICAL_TEXT } from './narrative-styles/lyrical.js';
import { COMEDY_TEXT } from './narrative-styles/comedy.js';
import { CLASSICAL_TEXT } from './narrative-styles/classical.js';
// Stable identities: extending the catalog must not replace saved selections.
// Only the resolved selection is projected into the writer's system prompt.
export const NARRATIVE_STYLE_PRESETS = [
    { id: 'system-light-novel', name: '日式轻小说', text: LIGHT_NOVEL_TEXT, readonly: true },
    { id: 'system-otome', name: '乙女风格', text: OTOME_TEXT, readonly: true },
    { id: 'system-cosmic-romance', name: '三体文风', text: COSMIC_ROMANCE_TEXT, readonly: true },
    { id: 'system-jrpg', name: '日式游戏', text: JRPG_TEXT, readonly: true },
    { id: 'system-cinematic', name: '电影感文风', text: CINEMATIC_TEXT, readonly: true },
    { id: 'system-annalistic', name: '春秋文风', text: ANNALISTIC_TEXT, readonly: true },
    { id: 'system-minimal', name: '极简文风', text: MINIMAL_TEXT, readonly: true },
    { id: 'system-delicate', name: '细腻文风', text: DELICATE_TEXT, readonly: true },
    { id: 'system-fantasy', name: '奇幻网文风', text: FANTASY_TEXT, readonly: true },
    { id: 'system-horror', name: '恐怖文风', text: HORROR_TEXT, readonly: true },
    { id: 'system-luxun', name: '鲁迅文风', text: LUXUN_TEXT, readonly: true },
    { id: 'system-lyrical', name: '抒情文风', text: LYRICAL_TEXT, readonly: true },
    { id: 'system-comedy', name: '日常搞笑风', text: COMEDY_TEXT, readonly: true },
    { id: 'system-classical', name: '古文文风', text: CLASSICAL_TEXT, readonly: true },
];
