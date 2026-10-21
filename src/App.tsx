import { lazy, Suspense, useEffect } from 'react';
import { ConfirmDialog } from './components/ConfirmDialog';
import { SettingsModal } from './components/SettingsModal';
import { SplitPane } from './components/SplitPane';
import { TabBar } from './components/TabBar';
import { ToastViewport } from './components/ToastViewport';
import { TopBar } from './components/TopBar';
import { useHotkeys } from './hooks/useHotkeys';
import { useMediaQuery } from './hooks/useMediaQuery';
import {
  startPersistence,
  useWorkbenchStore,
} from './store/useWorkbenchStore';

const EditorPanel = lazy(() =>
  import('./components/EditorPanel').then((m) => ({ default: m.EditorPanel })),
);
const TreePanel = lazy(() =>
  import('./components/TreePanel').then((m) => ({ default: m.TreePanel })),
);

const AUTO_REBUILD_LIMIT = 200_000;

export default function App() {
  useHotkeys();
  const narrow = useMediaQuery('(max-width: 840px)');
  const tab = useWorkbenchStore((s) =>
    s.tabs.find((t) => t.id === s.activeTabId),
  );
  const settings = useWorkbenchStore((s) => s.settings);
  const patchSettings = useWorkbenchStore((s) => s.patchSettings);
  const drawerOpen = useWorkbenchStore((s) => s.treeDrawerOpen);
  const setDrawer = useWorkbenchStore((s) => s.setTreeDrawerOpen);

  useEffect(() => startPersistence(), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const { tabs, activeTabId, settings, applyFormat } =
        useWorkbenchStore.getState();
      const current = tabs.find((x) => x.id === activeTabId);
      if (!current || current.tree || current.type === 'list') return;
      const source = current.formatted || current.raw;
      if (!source.trim() || source.length > AUTO_REBUILD_LIMIT) return;
      void import('./hooks/useFormat').then(({ formatAsync }) => {
        void formatAsync(current.type, source, {
          indent: settings.indentSize,
          attributeWrapThreshold: settings.attributeWrapThreshold,
        }).then((result) => {
          if (!useWorkbenchStore.getState().tabs.some((x) => x.id === current.id)) {
            return;
          }
          applyFormat(current.id, result, false);
        });
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', settings.theme === 'light');
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    document.documentElement.style.colorScheme = settings.theme;
  }, [settings.theme]);

  return (
    <div className="app">
      <TopBar />
      <TabBar />
      {narrow && tab?.type !== 'list' && (
        <div className="mobile-tree-bar">
          <button type="button" onClick={() => setDrawer(true)}>
            Open tree
          </button>
        </div>
      )}
      {tab ? (
        <SplitPane
          widthPct={settings.sidePaneWidth}
          collapsed={settings.sidePaneCollapsed}
          onWidth={(sidePaneWidth) => patchSettings({ sidePaneWidth })}
          onCollapsed={(sidePaneCollapsed) =>
            patchSettings({ sidePaneCollapsed })
          }
          drawer={narrow}
          drawerOpen={drawerOpen}
          onDrawer={setDrawer}
          hideSide={tab.type === 'list'}
          left={
            <Suspense fallback={<div className="loading">Loading editor…</div>}>
              <EditorPanel key={tab.id} tab={tab} />
            </Suspense>
          }
          right={
            <Suspense fallback={<div className="empty-hint">Loading tree…</div>}>
              <TreePanel key={tab.id} tab={tab} />
            </Suspense>
          }
        />
      ) : (
        <div className="empty-hint">Create a tab to start</div>
      )}
      <SettingsModal />
      <ConfirmDialog />
      <ToastViewport />
    </div>
  );
}
