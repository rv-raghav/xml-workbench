import { useWorkbenchStore } from '../store/useWorkbenchStore';

export function ConfirmDialog() {
  const id = useWorkbenchStore((s) => s.confirmCloseId);
  const tabs = useWorkbenchStore((s) => s.tabs);
  const confirm = useWorkbenchStore((s) => s.confirmClose);
  const cancel = useWorkbenchStore((s) => s.cancelClose);
  if (!id) return null;
  const tab = tabs.find((t) => t.id === id);
  return (
    <div className="modal-backdrop" role="presentation" onClick={cancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="close-title">Close tab?</h2>
        <p>
          <strong>{tab?.name ?? 'This tab'}</strong> has content that will be
          discarded.
        </p>
        <div className="modal-actions">
          <button type="button" onClick={cancel}>
            Cancel
          </button>
          <button type="button" className="danger" onClick={confirm}>
            Close tab
          </button>
        </div>
      </div>
    </div>
  );
}
