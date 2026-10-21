import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  type FormatResult,
  type SettingsState,
  type TabState,
  type TabType,
  type ToastItem,
} from '../types';
import {
  applyRename,
  createTab,
  defaultTabName,
  loadWorkbench,
  MAX_PERSIST_BYTES,
  reorderTabs,
  serializeWorkbench,
  STORAGE_KEY,
  tabHasContent,
  uniqueName,
} from './tabs';
import { idsToLevel } from '../utils/xmlToTree';

interface WorkbenchStore {
  tabs: TabState[];
  activeTabId: string | null;
  settings: SettingsState;
  toasts: ToastItem[];
  confirmCloseId: string | null;
  settingsOpen: boolean;
  treeDrawerOpen: boolean;

  activeTab: () => TabState | undefined;
  addTab: (type?: TabType) => void;
  closeTab: (id: string, force?: boolean) => void;
  confirmClose: () => void;
  cancelClose: () => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, name: string) => void;
  moveTab: (from: number, to: number) => void;
  switchRelative: (delta: number) => void;
  updateTab: (id: string, patch: Partial<TabState>) => void;
  applyFormat: (id: string, result: FormatResult, switchToFormatted?: boolean) => void;
  setTabType: (id: string, type: TabType) => void;
  clearAllTabs: () => void;
  patchSettings: (patch: Partial<SettingsState>) => void;
  toast: (kind: ToastItem['kind'], message: string) => void;
  dismissToast: (id: string) => void;
  setSettingsOpen: (open: boolean) => void;
  setTreeDrawerOpen: (open: boolean) => void;
}

function initialState(): Pick<WorkbenchStore, 'tabs' | 'activeTabId' | 'settings'> {
  const loaded = loadWorkbench(
    typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY),
  );
  if (loaded && loaded.tabs.length > 0) {
    const settings = {
      ...DEFAULT_SETTINGS,
      ...(loaded.settings as Partial<SettingsState> | undefined),
    };
    const tabs = loaded.tabs.map((t) => ({
      ...t,
      isFormatting: false,
    }));
    const activeTabId =
      loaded.activeTabId && tabs.some((t) => t.id === loaded.activeTabId)
        ? loaded.activeTabId
        : tabs[0].id;
    return { tabs, activeTabId, settings };
  }
  const tab = createTab('xml', { name: 'XML' });
  return { tabs: [tab], activeTabId: tab.id, settings: DEFAULT_SETTINGS };
}

export const useWorkbenchStore = create<WorkbenchStore>((set, get) => ({
  ...initialState(),
  toasts: [],
  confirmCloseId: null,
  settingsOpen: false,
  treeDrawerOpen: false,

  activeTab: () => get().tabs.find((t) => t.id === get().activeTabId),

  addTab: (type = 'xml') => {
    const names = get().tabs.map((t) => t.name);
    const tab = createTab(type, {
      name: uniqueName(names, defaultTabName(type)),
    });
    set({ tabs: [...get().tabs, tab], activeTabId: tab.id });
  },

  closeTab: (id, force = false) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return;
    if (!force && tabHasContent(tab)) {
      set({ confirmCloseId: id });
      return;
    }
    const tabs = get().tabs.filter((t) => t.id !== id);
    if (tabs.length === 0) {
      const next = createTab('xml');
      set({ tabs: [next], activeTabId: next.id, confirmCloseId: null });
      return;
    }
    let activeTabId = get().activeTabId;
    if (activeTabId === id) {
      const idx = get().tabs.findIndex((t) => t.id === id);
      activeTabId = (tabs[idx] ?? tabs[idx - 1]).id;
    }
    set({ tabs, activeTabId, confirmCloseId: null });
  },

  confirmClose: () => {
    const id = get().confirmCloseId;
    if (id) get().closeTab(id, true);
  },

  cancelClose: () => set({ confirmCloseId: null }),

  setActiveTab: (id) => set({ activeTabId: id }),

  renameTab: (id, name) => set({ tabs: applyRename(get().tabs, id, name) }),

  moveTab: (from, to) => set({ tabs: reorderTabs(get().tabs, from, to) }),

  switchRelative: (delta) => {
    const { tabs, activeTabId } = get();
    if (tabs.length === 0) return;
    const idx = Math.max(0, tabs.findIndex((t) => t.id === activeTabId));
    const next = (idx + delta + tabs.length) % tabs.length;
    set({ activeTabId: tabs[next].id });
  },

  updateTab: (id, patch) =>
    set({
      tabs: get().tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }),

  applyFormat: (id, result, switchToFormatted = true) => {
    const tab = get().tabs.find((t) => t.id === id);
    const expandLevel = get().settings.defaultTreeExpandLevel;
    const expanded = result.tree ? idsToLevel(result.tree, expandLevel) : [];
    get().updateTab(id, {
      formatted: result.formatted,
      minified: result.minified,
      error: result.error,
      notices: result.notices,
      canUnescape: result.canUnescape,
      usedLenient: result.usedLenient,
      tree: result.tree,
      treeExpandedIds: expanded,
      isFormatting: false,
      editorView: switchToFormatted ? 'formatted' : (tab?.editorView ?? 'formatted'),
    });
  },

  setTabType: (id, type) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab) return;
    get().updateTab(id, {
      type,
      error: null,
      notices: [],
      tree: null,
      formatted: tab.raw,
      minified: '',
      editorView: 'input',
    });
  },

  clearAllTabs: () => {
    const tab = createTab('xml', { name: 'XML' });
    set({ tabs: [tab], activeTabId: tab.id });
    get().toast('info', 'Cleared all tabs');
  },

  patchSettings: (patch) =>
    set({ settings: { ...get().settings, ...patch } }),

  toast: (kind, message) => {
    const item: ToastItem = { id: crypto.randomUUID(), kind, message };
    set({ toasts: [...get().toasts, item] });
    setTimeout(() => get().dismissToast(item.id), 3200);
  },

  dismissToast: (id) =>
    set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setTreeDrawerOpen: (open) => set({ treeDrawerOpen: open }),
}));

let persistTimer: ReturnType<typeof setTimeout> | undefined;

export function startPersistence(): () => void {
  return useWorkbenchStore.subscribe((state, prev) => {
    if (
      state.tabs === prev.tabs &&
      state.activeTabId === prev.activeTabId &&
      state.settings === prev.settings
    ) {
      return;
    }
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const payload = serializeWorkbench({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        settings: state.settings,
      });
      if (payload.length > MAX_PERSIST_BYTES) {
        const active = state.tabs.find((t) => t.id === state.activeTabId);
        const slim = serializeWorkbench({
          tabs: active ? [active] : [],
          activeTabId: state.activeTabId,
          settings: state.settings,
        });
        try {
          localStorage.setItem(STORAGE_KEY, slim);
        } catch {
          /* quota */
        }
        return;
      }
      try {
        localStorage.setItem(STORAGE_KEY, payload);
      } catch {
        /* quota */
      }
    }, 350);
  });
}
