/** Resolve the owned composition and resources beside the installed product. */
import type {Context} from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'

export default class NextTavernComposition extends Include {
  constructor(ctx: Context, config: Pick<Include.Config, 'patches'> = {}) {
    super(ctx, {
      path: new URL('../../../preset/agent.cordis.yml', import.meta.url).href,
      patches: config.patches,
    })
  }
}
