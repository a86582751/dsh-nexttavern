// Generated from runtime/alpha3/compat/ui-chat/src/client/chat/use-disclosure.ts; edit the TypeScript source.
/** Bind independent disclosure state to a Chat seat's reset source. */
import { useCallback, useState, useSyncExternalStore } from 'react';
/**
 * Own one initially collapsed disclosure without an external subscription.
 * @param version - reset generation; unchanged generations retain local open state.
 * @returns the open state, an explicit setter, and a toggle action.
 */
export function useDisclosure(version = 0) {
    const [expandedVersion, setExpandedVersion] = useState(null);
    const expanded = expandedVersion === version;
    const setExpanded = useCallback((open) => {
        setExpandedVersion(open ? version : null);
    }, [version]);
    const toggle = useCallback(() => {
        setExpandedVersion(previous => previous === version ? null : version);
    }, [version]);
    return { expanded, setExpanded, toggle };
}
/**
 * Bind a Hook without subscribing until a component calls it.
 * @param reset - stable source whose version advances when the seat is hidden by its Turn.
 * @returns a Hook with independent open state for each invocation.
 */
export function bindDisclosure(reset) {
    const subscribe = (listener) => reset.subscribe(listener);
    const getSnapshot = () => reset.getSnapshot();
    return function useBoundDisclosure() {
        const version = useSyncExternalStore(subscribe, getSnapshot);
        return useDisclosure(version);
    };
}
