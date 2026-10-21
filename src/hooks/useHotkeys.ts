import { useEffect } from 'react';
import { useWorkbenchStore } from '../store/useWorkbenchStore';

export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const store = useWorkbenchStore.getState();
      if (mod && e.key.toLowerCase() === 't') {
        e.preventDefault();
        store.addTab(store.activeTab()?.type ?? 'xml');
        return;
      }
      if (mod && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (store.activeTabId) store.closeTab(store.activeTabId);
        return;
      }
      if (mod && e.key === 'Tab') {
        e.preventDefault();
        store.switchRelative(e.shiftKey ? -1 : 1);
        return;
      }
      if (mod && e.key === 'PageDown') {
        e.preventDefault();
        store.switchRelative(1);
        return;
      }
      if (mod && e.key === 'PageUp') {
        e.preventDefault();
        store.switchRelative(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
