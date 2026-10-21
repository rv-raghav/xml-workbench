import type { TabState, TabType } from '../types';

export function createTab(
  type: TabType = 'xml',
  partial?: Partial<TabState>,
): TabState {
  const n = partial?.name;
  return {
    id: partial?.id ?? crypto.randomUUID(),
    name: n && n.trim() ? n : defaultTabName(type),
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
    createdAt: Date.now(),
    editorView: 'input',
    selectedNodeId: null,
    isFormatting: false,
    cursorOffset: 0,
    scrollTop: 0,
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

export function tabHasContent(tab: TabState): boolean {
  return Boolean(tab.raw.trim() || tab.formatted.trim());
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
        tree: null,
        isFormatting: false,
      })),
    };
  } catch {
    return null;
  }
}
