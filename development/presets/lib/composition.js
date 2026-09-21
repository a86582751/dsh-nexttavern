// Generated from runtime/alpha3/compat/presets/src/composition.ts; edit the TypeScript source.
import Include from '@deepseek-ai/cordis-plugin-include';
export default class NextTavernComposition extends Include {
    constructor(ctx) {
        super(ctx, { path: new URL('../../../preset/agent.cordis.yml', import.meta.url).href });
    }
}
