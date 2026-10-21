import { DEFAULT_SETTINGS } from '../types';
import { useWorkbenchStore } from '../store/useWorkbenchStore';

export function SettingsModal() {
  const open = useWorkbenchStore((s) => s.settingsOpen);
  const settings = useWorkbenchStore((s) => s.settings);
  const patch = useWorkbenchStore((s) => s.patchSettings);
  const close = useWorkbenchStore((s) => s.setSettingsOpen);
  const clearAll = useWorkbenchStore((s) => s.clearAllTabs);
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={() => close(false)}>
      <div
        className="modal settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="settings-title">Settings</h2>
        <label>
          Indent
          <select
            value={String(settings.indentSize)}
            onChange={(e) => {
              const v = e.target.value;
              patch({ indentSize: v === 'tab' ? 'tab' : (Number(v) as 2 | 4) });
            }}
          >
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tab</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.autoFormatOnPaste}
            onChange={(e) => patch({ autoFormatOnPaste: e.target.checked })}
          />
          Auto-format on paste
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.wordWrap}
            onChange={(e) => patch({ wordWrap: e.target.checked })}
          />
          Word wrap
        </label>
        <label>
          Font size
          <input
            type="number"
            min={11}
            max={22}
            value={settings.fontSize}
            onChange={(e) => patch({ fontSize: Number(e.target.value) })}
          />
        </label>
        <label>
          Wrap attributes when tag longer than
          <input
            type="number"
            min={0}
            max={400}
            value={settings.attributeWrapThreshold}
            onChange={(e) =>
              patch({ attributeWrapThreshold: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Default tree expansion level
          <input
            type="number"
            min={0}
            max={20}
            value={settings.defaultTreeExpandLevel}
            onChange={(e) =>
              patch({ defaultTreeExpandLevel: Number(e.target.value) })
            }
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="danger" onClick={clearAll}>
            Clear all tabs
          </button>
          <button
            type="button"
            onClick={() => patch(DEFAULT_SETTINGS)}
          >
            Reset
          </button>
          <button type="button" className="primary" onClick={() => close(false)}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
