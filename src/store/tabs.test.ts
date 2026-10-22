import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyRename,
  createTab,
  loadWorkbench,
  reorderTabs,
  serializeWorkbench,
  STORAGE_KEY,
  switchTabType,
  tabHasContent,
} from './tabs';
import { DEFAULT_SETTINGS } from '../types';

describe('tabs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds a tab with defaults', () => {
    const tab = createTab('xml');
    expect(tab.type).toBe('xml');
    expect(tab.name).toBe('XML');
    expect(tab.raw).toBe('');
    expect(tabHasContent(tab)).toBe(false);
  });

  it('renames a tab', () => {
    const a = createTab('xml', { id: '1', name: 'XML' });
    const renamed = applyRename([a], '1', '  Order payload  ');
    expect(renamed[0].name).toBe('Order payload');
  });

  it('reorders tabs', () => {
    const tabs = [
      createTab('xml', { id: 'a', name: 'A' }),
      createTab('json', { id: 'b', name: 'B' }),
      createTab('xml', { id: 'c', name: 'C' }),
    ];
    const moved = reorderTabs(tabs, 0, 2);
    expect(moved.map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('persists and restores tabs', () => {
    const tabs = [
      createTab('xml', { id: 't1', name: 'One', raw: '<a/>' }),
      createTab('json', { id: 't2', name: 'Two', raw: '{}' }),
    ];
    const raw = serializeWorkbench({
      tabs,
      activeTabId: 't2',
      settings: DEFAULT_SETTINGS,
    });
    localStorage.setItem(STORAGE_KEY, raw);
    const loaded = loadWorkbench(localStorage.getItem(STORAGE_KEY));
    expect(loaded?.tabs).toHaveLength(2);
    expect(loaded?.activeTabId).toBe('t2');
    expect(loaded?.tabs[0].raw).toBe('<a/>');
    expect(loaded?.tabs[1].type).toBe('json');
    expect(JSON.parse(raw).tabs[0].tree).toBeNull();
  });

  it('treats whitespace-only tabs as empty', () => {
    const tab = createTab('xml', { raw: '  \n  ' });
    expect(tabHasContent(tab)).toBe(false);
  });

  it('keeps xml, json, and list drafts separate when switching type', () => {
    const xml = createTab('xml', { raw: '<order id="1"/>', formatted: '<order id="1"/>' });
    const json = switchTabType(xml, 'json');
    expect(json.type).toBe('json');
    expect(json.raw).toBe('');
    expect(json.drafts.xml?.raw).toBe('<order id="1"/>');

    const withJson = { ...json, raw: '{"a":1}', formatted: '{\n  "a": 1\n}' };
    const list = switchTabType(withJson, 'list');
    expect(list.raw).toBe('');
    expect(list.drafts.json?.raw).toBe('{"a":1}');
    expect(list.drafts.xml?.raw).toBe('<order id="1"/>');

    const backToXml = switchTabType(list, 'xml');
    expect(backToXml.raw).toBe('<order id="1"/>');
    expect(backToXml.type).toBe('xml');

    const notepad = switchTabType(backToXml, 'notepad');
    expect(notepad.raw).toBe('');
    expect(notepad.type).toBe('notepad');
    expect(switchTabType({ ...notepad, raw: 'alpha\nbeta' }, 'xml').raw).toBe(
      '<order id="1"/>',
    );
  });

  it('replace fills the target type without leaking into the previous draft', () => {
    const xml = createTab('xml', { raw: '<root/>', formatted: '<root/>' });
    const converted = switchTabType(xml, 'json', {
      raw: '{"root":{}}',
      formatted: '{\n  "root": {}\n}',
    });
    expect(converted.type).toBe('json');
    expect(converted.raw).toBe('{"root":{}}');
    expect(converted.drafts.xml?.raw).toBe('<root/>');
  });
});
