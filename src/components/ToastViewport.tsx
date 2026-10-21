import { useWorkbenchStore } from '../store/useWorkbenchStore';

export function ToastViewport() {
  const toasts = useWorkbenchStore((s) => s.toasts);
  const dismiss = useWorkbenchStore((s) => s.dismissToast);
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          className={`toast toast-${t.kind}`}
          onClick={() => dismiss(t.id)}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
