// Adapted from DeepSeek MIT source 477b4f420553e8a52c2fbccc464d7561b239c443:
// packages/session/session-format-v3-to-v4/src/facts.ts; see PROVENANCE.md and LICENSE.
import {SessionFormatError,isSessionFormatJsonObject,sessionFormatCount} from '@deepseek-ai/dsh-session-format'
import type {SessionFormatJsonObject,SessionFormatJsonValue} from '@deepseek-ai/dsh-session-format'

export function catalogFact(value: SessionFormatJsonValue, subject = 'subagent/catalog'): SessionFormatJsonObject {
  if (!isSessionFormatJsonObject(value) || (value['version'] !== 0 && value['version'] !== 1)
    || typeof value['childId'] !== 'string'
    || (value['mode'] !== 'continuable' && value['mode'] !== 'one-shot' && value['mode'] !== 'unknown')
    || (value['version'] === 0 && value['mode'] === 'unknown')
    || (value['mode'] === 'continuable' && typeof value['label'] !== 'string')
    || (value['label'] !== undefined && typeof value['label'] !== 'string')) {
    throw new SessionFormatError(`${subject} requires a supported versioned catalog fact`)
  }
  sessionFormatCount(value['childCreatedAt'], 'catalog child creation time')
  return value
}

