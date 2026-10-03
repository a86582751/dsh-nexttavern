/** Private Core supplies the live classification inside the existing Source lock.
 * These return values describe data; callers cannot use them as write permission. */
export type LegacyWorldbookWriteTargetV1 =
  | {readonly kind:'legacy-write-data'}
  | {readonly kind:'source-managed-data';readonly entryId?:string;readonly sourcePointer?:string}

export type CheckLegacyWorldbookWriteTargetV1 =
  (session:{readonly id:string},id:string)=>LegacyWorldbookWriteTargetV1

/** First managed target in request order, or ordinary legacy DATA for the bulk.
 * The caller retains the existing Source mutation lock and write authority. */
export type CheckLegacyWorldbookWriteTargetsV1 =
  (session:{readonly id:string},ids:readonly string[])=>LegacyWorldbookWriteTargetV1

export const SOURCE_WORLDBOOK_EDITOR_REQUIRED_V1 = Object.freeze({
  ok:false as const,
  code:'SOURCE_WORLDBOOK_EDITOR_REQUIRED' as const,
  error:'该条目属于 SillyTavern 世界书，请在已有的结构化世界书面板中编辑。',
})
