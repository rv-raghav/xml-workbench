import type { TabContent, TabState, TabType } from '../types';

export function emptyTabContent(): TabContent {
  return {
    raw: '',
    formatted: '',
    minified: '',
    error: null,
    notices: [],
    canUnescape: false,
    usedLenient: false,
    tree: null,
    treeExpandedIds: [],
    searchQuery: '',
    editorView: 'input',
    selectedNodeId: null,
    isFormatting: false,
    cursorOffset: 0,
    scrollTop: 0,
  };
}

export function snapshotTabContent(tab: TabContent): TabContent {
  const content = emptyTabContent();
  content.raw = tab.raw;
  content.formatted = tab.formatted;
  content.minified = tab.minified;
  content.error = tab.error;
  content.notices = tab.notices;
  content.canUnescape = tab.canUnescape;
  content.usedLenient = tab.usedLenient;
  content.tree = tab.tree;
  content.treeExpandedIds = tab.treeExpandedIds;
  content.searchQuery = tab.searchQuery;
  content.editorView = tab.editorView;
  content.selectedNodeId = tab.selectedNodeId;
  content.isFormatting = false;
  content.cursorOffset = tab.cursorOffset;
  content.scrollTop = tab.scrollTop;
  return content;
}

export function switchTabType(
  tab: TabState,
  nextType: TabType,
  replace?: Partial<TabContent>,
): TabState {
  if (tab.type === nextType && !replace) return tab;
  const drafts: TabState['drafts'] = {
    ...tab.drafts,
    [tab.type]: snapshotTabContent(tab),
  };
  const restored = replace
    ? { ...emptyTabContent(), ...replace }
    : (drafts[nextType] ?? emptyTabContent());
  return {
    ...tab,
    ...restored,
    drafts,
    type: nextType,
  };
}

export function createTab(
  type: TabType = 'xml',
  partial?: Partial<TabState>,
): TabState {
  const n = partial?.name;
  return {
    id: partial?.id ?? crypto.randomUUID(),
    name: n && n.trim() ? n : defaultTabName(type),
    ...emptyTabContent(),
    createdAt: Date.now(),
    drafts: {},
    ...partial,
    type,
  };
}

export function defaultTabName(type: TabType): string {
  if (type === 'xml') return 'XML';
  if (type === 'json') return 'JSON';
  return 'List';
}

export function uniqueName(existing: string[], base: string): string {
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base} ${i}`)) i += 1;
  return `${base} ${i}`;
}

export function reorderTabs<T>(items: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  ) {
    return items;
  }
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function contentHasText(content: TabContent): boolean {
  return Boolean(content.raw.trim() || content.formatted.trim());
}

export function tabHasContent(tab: TabState): boolean {
  if (contentHasText(tab)) return true;
  return Object.values(tab.drafts ?? {}).some(
    (draft) => draft && contentHasText(draft),
  );
}

export function applyRename(
  tabs: TabState[],
  id: string,
  name: string,
): TabState[] {
  const trimmed = name.trim();
  if (!trimmed) return tabs;
  return tabs.map((t) => (t.id === id ? { ...t, name: trimmed } : t));
}

export const STORAGE_KEY = 'xml-workbench:v1';
export const MAX_PERSIST_FIELD_CHARS = 1_500_000;
export const MAX_PERSIST_BYTES = 4_000_000;

export interface PersistedWorkbench {
  tabs: TabState[];
  activeTabId: string | null;
  settings: unknown;
}

function capText(value: string): string {
  if (value.length <= MAX_PERSIST_FIELD_CHARS) return value;
  return value.slice(0, MAX_PERSIST_FIELD_CHARS);
}

export function serializeWorkbench(state: PersistedWorkbench): string {
  return JSON.stringify({
    tabs: state.tabs.map((t) => ({
      ...t,
      raw: capText(t.raw),
      formatted: capText(t.formatted),
      minified: capText(t.minified),
      isFormatting: false,
      tree: null,
      drafts: Object.fromEntries(
        Object.entries(t.drafts ?? {}).map(([key, draft]) => [
          key,
          draft
            ? {
                ...draft,
                raw: capText(draft.raw),
                formatted: capText(draft.formatted),
                minified: capText(draft.minified),
                tree: null,
                isFormatting: false,
              }
            : draft,
        ]),
      ),
    })),
    activeTabId: state.activeTabId,
    settings: state.settings,
  });
}

export function loadWorkbench(raw: string | null): PersistedWorkbench | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PersistedWorkbench;
    if (!data || !Array.isArray(data.tabs)) return null;
    return {
      ...data,
      tabs: data.tabs.map((t) => ({
        ...t,
        drafts: t.drafts ?? {},
        tree: null,
        isFormatting: false,
      })),
    };
  } catch {
    return null;
  }
}
