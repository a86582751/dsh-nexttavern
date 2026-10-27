/** Deliberately wrong fixture: the capability suite must reject this successful no-op. */
export async function tryLockExclusive(_fd: number): Promise<void> {}
