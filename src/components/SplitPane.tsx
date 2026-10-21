import { useCallback, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  widthPct: number;
  collapsed: boolean;
  onWidth: (pct: number) => void;
  onCollapsed: (collapsed: boolean) => void;
  drawer: boolean;
  drawerOpen: boolean;
  onDrawer: (open: boolean) => void;
  hideSide?: boolean;
}

export function SplitPane({
  left,
  right,
  widthPct,
  collapsed,
  onWidth,
  onCollapsed,
  drawer,
  drawerOpen,
  onDrawer,
  hideSide = false,
}: SplitPaneProps) {
  const startDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const split = e.currentTarget.parentElement;
      if (!split) return;
      const onMove = (ev: globalThis.PointerEvent) => {
        const rect = split.getBoundingClientRect();
        const pct = ((rect.right - ev.clientX) / rect.width) * 100;
        onWidth(Math.min(70, Math.max(18, pct)));
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onWidth],
  );

  if (hideSide) {
    return (
      <div className="split">
        <div className="pane pane-main">{left}</div>
      </div>
    );
  }

  if (drawer) {
    return (
      <div className="split drawer-mode">
        <div className="pane pane-main">{left}</div>
        {drawerOpen && (
          <>
            <button
              type="button"
              className="drawer-scrim"
              aria-label="Close tree"
              onClick={() => onDrawer(false)}
            />
            <aside className="pane pane-side drawer">{right}</aside>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="split">
      <div className="pane pane-main">{left}</div>
      {!collapsed && (
        <>
          <div
            className="split-handle"
            role="separator"
            aria-orientation="vertical"
            onPointerDown={startDrag}
          />
          <aside
            className="pane pane-side"
            style={{ width: `${widthPct}%` }}
          >
            {right}
          </aside>
        </>
      )}
      <button
        type="button"
        className="collapse-btn"
        onClick={() => onCollapsed(!collapsed)}
        aria-label={collapsed ? 'Show tree pane' : 'Hide tree pane'}
      >
        {collapsed ? '« Tree' : '»'}
      </button>
    </div>
  );
}
