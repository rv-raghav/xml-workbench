import { useState } from 'react';
import { useWorkbenchStore } from '../store/useWorkbenchStore';

export function TabBar() {
  const tabs = useWorkbenchStore((s) => s.tabs);
  const activeTabId = useWorkbenchStore((s) => s.activeTabId);
  const setActiveTab = useWorkbenchStore((s) => s.setActiveTab);
  const closeTab = useWorkbenchStore((s) => s.closeTab);
  const addTab = useWorkbenchStore((s) => s.addTab);
  const renameTab = useWorkbenchStore((s) => s.renameTab);
  const moveTab = useWorkbenchStore((s) => s.moveTab);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const startRename = (id: string, name: string) => {
    setEditingId(id);
    setDraft(name);
  };

  const commitRename = () => {
    if (editingId) renameTab(editingId, draft);
    setEditingId(null);
  };

  return (
    <div className="tabbar">
      <div className="tablist" role="tablist" aria-label="Open documents">
        {tabs.map((tab, index) => {
          const selected = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={`tab ${selected ? 'active' : ''}`}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) moveTab(dragIndex, index);
                setDragIndex(null);
              }}
              onClick={() => setActiveTab(tab.id)}
              onDoubleClick={() => startRename(tab.id, tab.name)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
            >
              {editingId === tab.id ? (
                <input
                  className="tab-rename"
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="tab-name">{tab.name}</span>
              )}
              <span className={`badge badge-${tab.type}`}>{tab.type}</span>
              <button
                type="button"
                className="tab-close"
                aria-label={`Close ${tab.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="tab-add"
        aria-label="New tab"
        title="New tab (Ctrl+T)"
        onClick={() => addTab(tabs.find((t) => t.id === activeTabId)?.type ?? 'xml')}
      >
        +
      </button>
    </div>
  );
}
