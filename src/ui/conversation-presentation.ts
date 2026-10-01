import type * as ReactAPI from 'react';
import {
  projectConversationList,
  projectConversationWorkspaces,
  projectConversationSearch,
  resolveConversationExecution,
} from './conversation-projection.js';
import type { ConversationCatalog, SessionList, WorkspaceSnapshot, SearchResult } from './conversation-projection.js';
interface Catalog extends ConversationCatalog {
  revision?: number;
  ok?: boolean;
}
interface CatalogState {
  status: string;
  value: Catalog | null;
  knownIds: readonly string[];
  error: string | null;
}
export type SessionSelector = <T>(selector: (value: SessionList) => T) => T;
type WorkspaceSelector = <T>(selector: (value: WorkspaceSnapshot) => T) => T;
interface BrowserProps {
  useSessions: SessionSelector;
  useWorkspaces: WorkspaceSelector;
  open(id: string): unknown;
  forkSession(id: string): unknown;
  searchSessions(...args: unknown[]): Promise<SearchResult>;
}
interface WorkspaceProps {
  browserProps: BrowserProps;
  renderDefault(props: BrowserProps): ReactAPI.ReactNode;
}
// One catalog/cache per plugin application. Keep requests, projection and
// subscription cleanup together; the entry owns native slot registration.
export function createConversationPresentation(
  { React, sessionsService, toast, errorMessage }: {
    React: typeof ReactAPI;
    sessionsService: {
      list?: {
        getSnapshot?(): SessionList;
      };
    };
    toast(message: string): unknown;
    errorMessage(error: unknown): string;
  }) {
  let conversationCatalog: CatalogState = {
    status: 'loading', value: null, knownIds: [], error: null
  };
  const conversationListeners = new Set<() => void>();
  let conversationLoad: Promise<Catalog> | null = null;
  const notifyConversations = () => {
    for (const listener of conversationListeners)
      listener();
  };
  const acceptConversations = (value: Catalog, knownIds = conversationCatalog.knownIds) => {
    if (value?.schemaVersion !== 1 || !value.worldlines || !value.conversations)
      return;
    if (conversationCatalog.value && value.revision !== undefined && conversationCatalog.value.revision !== undefined



      && value.revision < conversationCatalog.value.revision)
      return;
    const sorted = [...knownIds].sort();
    if (conversationCatalog.status === 'ready' && conversationCatalog.value?.revision === value.revision



      && JSON.stringify(sorted) === JSON.stringify(conversationCatalog.knownIds))
      return;
    conversationCatalog = {
      status: 'ready', value, knownIds: sorted, error: null
    };
    notifyConversations();
  };
  const loadConversations = async (): Promise<Catalog> => {
    if (conversationLoad)
      return conversationLoad;
    const knownIds = sessionsService?.list?.getSnapshot?.()?.ids ?? [];
    conversationLoad = (async () => {
      const response = await fetch('/api/roleplay/conversations'), data = await response.json();
      if (!response.ok || !data?.ok || !data.worldlines || !data.conversations)
        throw new Error('酒馆会话目录暂时不可用');
      acceptConversations(data, knownIds);
      return data;
    })().catch(
      error => {
        conversationCatalog = {
          ...conversationCatalog, status: 'error', error: String(errorMessage(error))
        };
        notifyConversations();
        throw error;
      })
      .finally(
        () => {
          conversationLoad = null;
        });
    return conversationLoad;
  };
  function TavernWorkspacePresentation({ browserProps, renderDefault }: WorkspaceProps) {
    const native = browserProps.useSessions(s => s);
    const catalog = React.useSyncExternalStore(
      React.useCallback(
        listener => {
          conversationListeners.add(listener);
          return () => conversationListeners.delete(listener);
        },
        []),
      React.useCallback(() => conversationCatalog, []));
    const idsKey = [...(native?.ids ?? [])].sort().join('\0');
    const catalogReadAt = React.useRef(0);
    const catalogTrailing = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    React.useEffect(
      () => {
        // The native session list settles in a stream of updates and each one used
        // to issue a full catalog read; at one round trip per read that kept a
        // connection busy for the whole session. Only this trigger is coalesced -
        // the timer, focus and visibility paths below still read immediately, and
        // a scheduled trailing read makes sure the last update is not lost.
        const CATALOG_READ_MIN_INTERVAL_MS = 10000;
        const readNow = () => {
          catalogReadAt.current = Date.now();
          void loadConversations().catch(() => {
          });
        };
        const wait = CATALOG_READ_MIN_INTERVAL_MS - (Date.now() - catalogReadAt.current);
        if (wait <= 0)
          readNow();
        else if (catalogTrailing.current === null)
          catalogTrailing.current = setTimeout(() => {
            catalogTrailing.current = null;
            readNow();
          }, wait);
        const refresh = () => {
          if (typeof document === 'undefined' || !document.hidden)
            readNow();
        };
        if (typeof document !== 'undefined')
          document.addEventListener('visibilitychange', refresh);
        if (typeof window !== 'undefined')
          window.addEventListener('focus', refresh);
        const timer = setInterval(refresh, 30000);
        return () => {
          clearInterval(timer);
          if (catalogTrailing.current !== null) {
            clearTimeout(catalogTrailing.current);
            catalogTrailing.current = null;
          }
          if (typeof document !== 'undefined')
            document.removeEventListener('visibilitychange', refresh);
          if (typeof window !== 'undefined')
            window.removeEventListener('focus', refresh);
        };
      },
      [idsKey]);
    const reconciledRef = React.useRef(new Set());
    React.useEffect(
      () => {
        if (!native.current || !catalog.value)
          return;
        const member = catalog.value.worldlines?.[native.current];
        const root = member?.conversationId ?? native.current;
        const active = resolveConversationExecution(root, catalog.value);
        const key = `${catalog.value.revision}:${root}:${native.current}:${active}`;
        if (active === native.current || reconciledRef.current.has(key))
          return;
        reconciledRef.current.add(key);
        browserProps.open(active);
      },
      [native.current, catalog.value?.revision]);
    const projections = React.useRef<{
      catalog: CatalogState;
      lists: WeakMap<SessionList, SessionList>;
      workspaces: WeakMap<WorkspaceSnapshot, WorkspaceSnapshot>;
    } | null>(
      null);
    if (projections.current?.catalog !== catalog)
      projections.current = {
        catalog, lists: new WeakMap(), workspaces: new WeakMap()
      };
    if (!catalog.value)
      return React.createElement(
        'div',
        {
          role: 'status', style: {
            padding: 12
          }
        },
        catalog.error ?? '正在读取酒馆会话…',
        catalog.error



        && React.createElement(
          'button',
          {
            onClick: () => void loadConversations().catch(() => {
            })
          },
          '重试'));
    const cached = <T extends object>(cache: WeakMap<T, T>, value: T, project: (value: T) => T) => {
      let result = cache.get(value);
      if (!result) {
        result = project(value);
        cache.set(value, result);
      }
      return result;
    };
    const known = new Set(catalog.knownIds);
    const usePresentedSessions: SessionSelector = selector => browserProps.useSessions(
      value => selector(
        cached(
          projections.current!.lists,
          value,
          snapshot => projectConversationList({
            ...snapshot, ids: (snapshot.ids ?? []).filter(id => known.has(id))
          }, catalog.value))));
    const usePresentedWorkspaces: WorkspaceSelector = selector => browserProps.useWorkspaces(
      value => selector(cached(projections.current!.workspaces, value, snapshot => projectConversationWorkspaces(snapshot, catalog.value))));
    const executionId = (id: string) => resolveConversationExecution(id, catalog.value);
    return renderDefault(
      {
        useSessions: usePresentedSessions,
        useWorkspaces: usePresentedWorkspaces,
        open: id => {
          void loadConversations().then(latest => browserProps.open(resolveConversationExecution(id, latest))).catch(error => toast(errorMessage(error)));
        },
        forkSession: id => browserProps.forkSession(executionId(id)),
        searchSessions: async (...args) => projectConversationSearch(await browserProps.searchSessions(...args), conversationCatalog.value),
      });
  }
  return {
    acceptConversations, loadConversations, TavernWorkspacePresentation
  };
}
