import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { List, useListRef, type RowComponentProps } from 'react-window';
import { useWorkbenchStore } from '../store/useWorkbenchStore';
import type { AppTreeNode, TabState, TreeKind } from '../types';
import { xmlStringToJson } from '../utils/convert';
import { indentString } from '../utils/indent';
import { nodeToXml } from '../utils/xmlFormatter';
import {
  allIds,
  ancestorIds,
  collectMatches,
  flattenVisible,
  idsToLevel,
} from '../utils/xmlToTree';

interface TreePanelProps {
  tab: TabState;
}

interface FlatRow extends AppTreeNode {
  depth: number;
}

interface TreeRowProps {
  rows: FlatRow[];
  expandedIds: string[];
  selectedId: string | null;
  matchIds: string[];
  onSelect: (node: AppTreeNode) => void;
  onToggle: (node: AppTreeNode) => void;
  onMenu: (x: number, y: number, node: AppTreeNode) => void;
}

export function TreePanel({ tab }: TreePanelProps) {
  const settings = useWorkbenchStore((s) => s.settings);
  const updateTab = useWorkbenchStore((s) => s.updateTab);
  const toast = useWorkbenchStore((s) => s.toast);
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [menu, setMenu] = useState<{ x: number; y: number; node: AppTreeNode } | null>(
    null,
  );
  const [matchIndex, setMatchIndex] = useState(0);
  const [level, setLevel] = useState(settings.defaultTreeExpandLevel);
  const listRef = useListRef(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setSize({ width: cr.width, height: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const expanded = useMemo(
    () => new Set(tab.treeExpandedIds),
    [tab.treeExpandedIds],
  );

  const matches = useMemo(
    () => collectMatches(tab.tree, tab.searchQuery),
    [tab.tree, tab.searchQuery],
  );

  const matchIds = useMemo(() => matches.map((m) => m.id), [matches]);

  const rows = useMemo(() => {
    if (!tab.tree) return [] as FlatRow[];
    return flattenVisible(tab.tree, expanded);
  }, [tab.tree, expanded]);

  useEffect(() => {
    if (!tab.searchQuery || matches.length === 0 || !tab.tree) return;
    const ids = new Set(tab.treeExpandedIds);
    for (const m of matches) {
      ancestorIds(tab.tree, m.id).forEach((id) => ids.add(id));
    }
    const next = [...ids];
    if (next.length !== tab.treeExpandedIds.length) {
      updateTab(tab.id, { treeExpandedIds: next });
    }
  }, [matches, tab.searchQuery, tab.id, tab.tree, tab.treeExpandedIds, updateTab]);

  const revealMatch = (index: number) => {
    if (matches.length === 0) return;
    const i = (index + matches.length) % matches.length;
    setMatchIndex(i);
    const node = matches[i];
    const ids = new Set(tab.treeExpandedIds);
    ancestorIds(tab.tree, node.id).forEach((id) => ids.add(id));
    updateTab(tab.id, {
      treeExpandedIds: [...ids],
      selectedNodeId: node.id,
    });
    const idx = rows.findIndex((r) => r.id === node.id);
    if (idx >= 0) listRef.current?.scrollToRow({ index: idx, align: 'center' });
  };

  const toggle = useCallback(
    (node: AppTreeNode) => {
      const ids = new Set(tab.treeExpandedIds);
      if (ids.has(node.id)) ids.delete(node.id);
      else ids.add(node.id);
      updateTab(tab.id, { treeExpandedIds: [...ids] });
    },
    [tab.id, tab.treeExpandedIds, updateTab],
  );

  const select = useCallback(
    (node: AppTreeNode) => {
      updateTab(tab.id, {
        selectedNodeId: node.id,
        editorView: 'formatted',
      });
    },
    [tab.id, updateTab],
  );

  const onMenu = useCallback((x: number, y: number, node: AppTreeNode) => {
    setMenu({ x, y, node });
  }, []);

  const copyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast('success', `${label} copied`);
    setMenu(null);
  };

  const indent = indentString(settings.indentSize);

  const onKeyDown = (e: KeyboardEvent) => {
    const idx = rows.findIndex((r) => r.id === tab.selectedNodeId);
    const current = idx >= 0 ? rows[idx] : rows[0];
    if (!current) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = rows[Math.min(rows.length - 1, idx + 1)];
      if (next) select(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = rows[Math.max(0, idx - 1)];
      if (prev) select(prev);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (current.children.length && !expanded.has(current.id)) toggle(current);
      else if (current.children[0]) select(current.children[0]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (expanded.has(current.id)) toggle(current);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(current);
    }
  };

  const rowKey = useCallback(
    (index: number) => rows[index]?.id ?? index,
    [rows],
  );

  const selectedNode = rows.find((r) => r.id === tab.selectedNodeId) ?? tab.tree;

  const rowProps: TreeRowProps = {
    rows,
    expandedIds: tab.treeExpandedIds,
    selectedId: tab.selectedNodeId,
    matchIds,
    onSelect: select,
    onToggle: toggle,
    onMenu,
  };

  return (
    <div className="tree-panel">
      <div className="tree-toolbar">
        <input
          className="tree-search"
          placeholder="Search tag, attr, text…"
          value={tab.searchQuery}
          onChange={(e) => {
            setMatchIndex(0);
            updateTab(tab.id, { searchQuery: e.target.value });
          }}
        />
        <button type="button" onClick={() => revealMatch(matchIndex - 1)}>
          Prev
        </button>
        <button type="button" onClick={() => revealMatch(matchIndex + 1)}>
          Next
        </button>
        <span className="match-count">
          {matches.length ? `${matchIndex + 1}/${matches.length}` : '0'}
        </span>
      </div>
      <div className="tree-toolbar">
        <button
          type="button"
          onClick={() =>
            tab.tree && updateTab(tab.id, { treeExpandedIds: allIds(tab.tree) })
          }
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={() =>
            tab.tree && updateTab(tab.id, { treeExpandedIds: [tab.tree.id] })
          }
        >
          Collapse all
        </button>
        <label className="level-label">
          Level
          <input
            type="number"
            min={0}
            max={30}
            value={level}
            onChange={(e) => setLevel(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          onClick={() =>
            tab.tree &&
            updateTab(tab.id, { treeExpandedIds: idsToLevel(tab.tree, level) })
          }
        >
          Expand
        </button>
      </div>
      <div
        ref={hostRef}
        className="tree-host"
        role="tree"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onClick={() => setMenu(null)}
      >
        {!tab.tree && (
          <div className="empty-hint">
            {tab.type === 'xml'
              ? 'Format XML to explore the tree'
              : 'Format JSON to explore the tree'}
          </div>
        )}
        {tab.tree && (
          <List<TreeRowProps>
            listRef={listRef}
            rowCount={rows.length}
            rowHeight={26}
            rowComponent={TreeRow}
            rowProps={rowProps}
            rowKey={rowKey}
            style={{
              height: size.height > 0 ? size.height : '100%',
              width: size.width > 0 ? size.width : '100%',
            }}
            defaultHeight={size.height > 0 ? size.height : 360}
          />
        )}
      </div>
      <div className="breadcrumb" title={selectedNode?.path}>
        {selectedNode?.path ?? '—'}
      </div>
      {menu && (
        <div
          className="context-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          <button
            type="button"
            onClick={() =>
              void copyText(menu.node.path, tab.type === 'xml' ? 'XPath' : 'Path')
            }
          >
            {tab.type === 'xml' ? 'Copy XPath' : 'Copy path'}
          </button>
          <button
            type="button"
            onClick={() =>
              void copyText(
                tab.type === 'xml'
                  ? nodeToXml(menu.node, indent)
                  : JSON.stringify(treeToValue(menu.node), null, indent),
                'Node',
              )
            }
          >
            Copy node as {tab.type === 'xml' ? 'XML' : 'JSON'}
          </button>
          <button
            type="button"
            onClick={() => void copyText(menu.node.preview ?? '', 'Value')}
          >
            Copy text value
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                const xml =
                  tab.type === 'xml' ? nodeToXml(menu.node, indent) : '<root/>';
                const json =
                  tab.type === 'xml'
                    ? xmlStringToJson(xml, {
                        indent: settings.indentSize,
                        attributeWrapThreshold: settings.attributeWrapThreshold,
                      })
                    : JSON.stringify(treeToValue(menu.node), null, indent);
                void copyText(json, 'JSON');
              } catch (err) {
                toast('error', err instanceof Error ? err.message : 'Copy failed');
              }
            }}
          >
            Copy as JSON
          </button>
          <button
            type="button"
            onClick={() => {
              const ids = new Set(tab.treeExpandedIds);
              allIds(menu.node).forEach((id) => ids.add(id));
              updateTab(tab.id, { treeExpandedIds: [...ids] });
              setMenu(null);
            }}
          >
            Expand subtree
          </button>
          <button
            type="button"
            onClick={() => {
              const ids = new Set(tab.treeExpandedIds);
              allIds(menu.node).forEach((id) => ids.delete(id));
              ids.add(menu.node.id);
              updateTab(tab.id, { treeExpandedIds: [...ids] });
              setMenu(null);
            }}
          >
            Collapse subtree
          </button>
        </div>
      )}
    </div>
  );
}

function TreeRow({
  index,
  style,
  rows,
  expandedIds,
  selectedId,
  matchIds,
  onSelect,
  onToggle,
  onMenu,
}: RowComponentProps<TreeRowProps>) {
  const node = rows[index];
  if (!node) return null;
  const isOpen = expandedIds.includes(node.id);
  const selected = node.id === selectedId;
  const isMatch = matchIds.includes(node.id);
  return (
    <div
      style={style}
      className={`tree-row ${selected ? 'selected' : ''} ${isMatch ? 'match' : ''}`}
      role="treeitem"
      aria-level={node.depth}
      aria-selected={selected}
      aria-expanded={node.children.length ? isOpen : undefined}
      onClick={() => onSelect(node)}
      onContextMenu={(e) => {
        e.preventDefault();
        onMenu(e.clientX, e.clientY, node);
      }}
    >
      {Array.from({ length: Math.max(0, node.depth - 1) }, (_, i) => (
        <span key={i} className="indent-guide" style={{ left: 8 + i * 14 }} />
      ))}
      <button
        type="button"
        className="twist"
        style={{ marginLeft: (node.depth - 1) * 14 }}
        disabled={node.children.length === 0}
        aria-label={isOpen ? 'Collapse' : 'Expand'}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(node);
        }}
      >
        {node.children.length === 0 ? '•' : isOpen ? '▾' : '▸'}
      </button>
      <span className={`kind kind-${node.kind}`}>{kindGlyph(node.kind)}</span>
      <span className="tree-label">
        {node.label}
        {node.siblingIndex ? `[${node.siblingIndex}]` : ''}
      </span>
      {!isOpen && node.childCount > 0 && (
        <span className="count">({node.childCount})</span>
      )}
      {node.attributes.map((a) => (
        <span key={a.name} className="chip">
          {a.name}=&quot;{a.value}&quot;
        </span>
      ))}
      {node.preview && node.kind !== 'object' && node.kind !== 'array' && (
        <span className="preview">{truncate(node.preview)}</span>
      )}
      <button
        type="button"
        className="kebab"
        aria-label="Node actions"
        onClick={(e) => {
          e.stopPropagation();
          onMenu(e.clientX, e.clientY, node);
        }}
      >
        ⋮
      </button>
    </div>
  );
}

function kindGlyph(kind: TreeKind): string {
  switch (kind) {
    case 'element':
      return '<>';
    case 'attribute':
      return '@';
    case 'text':
      return 'T';
    case 'comment':
      return '#';
    case 'cdata':
      return 'C';
    case 'pi':
      return '?';
    case 'object':
      return '{}';
    case 'array':
      return '[]';
    case 'string':
      return 'S';
    case 'number':
      return '#';
    case 'boolean':
      return 'B';
    case 'null':
      return '∅';
    default:
      return '•';
  }
}

function truncate(value: string): string {
  const t = value.replace(/\s+/g, ' ').trim();
  return t.length > 48 ? `${t.slice(0, 45)}…` : t;
}

function treeToValue(node: AppTreeNode): unknown {
  if (node.kind === 'array') return node.children.map(treeToValue);
  if (node.kind === 'object' || node.kind === 'element') {
    const obj: Record<string, unknown> = {};
    for (const attr of node.attributes) obj[`@${attr.name}`] = attr.value;
    if (node.children.length === 0) {
      if (node.preview && Object.keys(obj).length === 0) return node.preview;
      if (node.preview) obj['#text'] = node.preview;
      return obj;
    }
    for (const child of node.children) {
      const value = treeToValue(child);
      if (child.label in obj) {
        const prev = obj[child.label];
        obj[child.label] = Array.isArray(prev) ? [...prev, value] : [prev, value];
      } else {
        obj[child.label] = value;
      }
    }
    return obj;
  }
  if (node.kind === 'number') return Number(node.preview);
  if (node.kind === 'boolean') return node.preview === 'true';
  if (node.kind === 'null') return null;
  return node.preview ?? null;
}
