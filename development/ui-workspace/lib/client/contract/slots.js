// Generated from runtime/alpha3/compat/ui-workspace/src/client/contract/slots.ts; edit the TypeScript source.
/**
 * Bind the row's render occurrence into the entries' `useMenuOpenState` hook:
 * the owner supplies its open-state pair as the occurrence's `hookContext`,
 * and the hook hands that pair back.
 * @param _standard - framework standard props (unused).
 * @param state - the menu's open-state pair from the render occurrence.
 * @returns the hook the entry calls.
 */
export const menuOpenStateFactory = (_standard, state) => () => state;
