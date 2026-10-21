import type { FormatError, FormatNotice } from '../types';

interface ErrorBarProps {
  error: FormatError | null;
  notices: FormatNotice[];
  canUnescape: boolean;
  usedLenient: boolean;
  onUnescape: () => void;
  onGotoError?: () => void;
}

export function ErrorBar({
  error,
  notices,
  canUnescape,
  usedLenient,
  onUnescape,
  onGotoError,
}: ErrorBarProps) {
  if (!error && notices.length === 0 && !canUnescape) return null;
  return (
    <div className="status-stack">
      {error && (
        <div className="banner error" role="alert">
          <span>
            {error.message} (line {error.line}, column {error.column})
            {usedLenient ? ' — showing lenient indentation.' : ''}
          </span>
          {onGotoError && (
            <button type="button" onClick={onGotoError}>
              Go to
            </button>
          )}
        </div>
      )}
      {notices
        .filter((n) => n.kind !== 'escaped')
        .map((n) => (
          <div key={n.kind} className={`banner ${n.kind}`}>
            {n.message}
          </div>
        ))}
      {canUnescape && (
        <div className="banner escaped">
          Input looks escaped.
          <button type="button" onClick={onUnescape}>
            Unescape and format
          </button>
        </div>
      )}
    </div>
  );
}
