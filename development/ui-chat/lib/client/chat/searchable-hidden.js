// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/searchable-hidden.ts; edit the TypeScript source.
import { useEffect, useLayoutEffect, useRef } from 'react';
/**
 * Apply searchable hidden state without unmounting a stable subtree.
 * @param hidden - whether the subtree is currently hidden.
 * @param reveal - callback for browser find's `beforematch` reveal.
 * @returns ref for the stable subtree root.
 */
export function useSearchableHidden(hidden, reveal) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const element = ref.current;
        if (element === null)
            return;
        if (hidden && element.contains(element.ownerDocument.activeElement)) {
            reveal();
            return;
        }
        if (hidden)
            element.setAttribute('hidden', 'until-found');
        else
            element.removeAttribute('hidden');
    }, [hidden, reveal]);
    useEffect(() => {
        const element = ref.current;
        if (element === null)
            return;
        element.addEventListener('beforematch', reveal);
        return () => { element.removeEventListener('beforematch', reveal); };
    }, [reveal]);
    return ref;
}
