export type TabType = 'xml' | 'json' | 'list';

export type EditorViewMode = 'input' | 'formatted';

export type IndentSize = 2 | 4 | 'tab';

export interface FormatError {
  message: string;
  line: number;
  column: number;
  index?: number;
}

export type TreeKind =
  | 'element'
  | 'attribute'
  | 'text'
  | 'comment'
  | 'cdata'
  | 'pi'
  | 'object'
  | 'array'
  | 'string'
  | 'number'
  | 'boolean'
  | 'null';

export interface TreeAttr {
  name: string;
  value: string;
}

export interface AppTreeNode {
  id: string;
  kind: TreeKind;
  label: string;
  preview?: string;
  attributes: TreeAttr[];
  children: AppTreeNode[];
  start: number;
  end: number;
  path: string;
  childCount: number;
  siblingIndex?: number;
  siblingCount?: number;
}

export interface FormatNotice {
  kind: 'trimmed' | 'escaped' | 'lenient';
  message: string;
}

export interface FormatResult {
  formatted: string;
  minified: string;
  tree: AppTreeNode | null;
  error: FormatError | null;
  notices: FormatNotice[];
  canUnescape: boolean;
  usedLenient: boolean;
  extracted: boolean;
}

export interface FormatOptions {
  indent: IndentSize;
  attributeWrapThreshold: number;
  sortKeys?: boolean;
}

export interface TabContent {
  raw: string;
  formatted: string;
  minified: string;
  error: FormatError | null;
  notices: FormatNotice[];
  canUnescape: boolean;
  usedLenient: boolean;
  tree: AppTreeNode | null;
  treeExpandedIds: string[];
  searchQuery: string;
  editorView: EditorViewMode;
  selectedNodeId: string | null;
  isFormatting: boolean;
  cursorOffset: number;
  scrollTop: number;
}

export interface TabState extends TabContent {
  id: string;
  name: string;
  type: TabType;
  createdAt: number;
  drafts: Partial<Record<TabType, TabContent>>;
}

export interface SettingsState {
  indentSize: IndentSize;
  autoFormatOnPaste: boolean;
  wordWrap: boolean;
  theme: 'light' | 'dark';
  fontSize: number;
  attributeWrapThreshold: number;
  defaultTreeExpandLevel: number;
  sidePaneWidth: number;
  sidePaneCollapsed: boolean;
}

export interface ToastItem {
  id: string;
  kind: 'success' | 'error' | 'info';
  message: string;
}

export const DEFAULT_SETTINGS: SettingsState = {
  indentSize: 2,
  autoFormatOnPaste: true,
  wordWrap: false,
  theme: 'dark',
  fontSize: 13,
  attributeWrapThreshold: 80,
  defaultTreeExpandLevel: 2,
  sidePaneWidth: 38,
  sidePaneCollapsed: false,
};
