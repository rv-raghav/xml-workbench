import { useWorkbenchStore } from '../store/useWorkbenchStore';

export function TopBar() {
  const tab = useWorkbenchStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const settings = useWorkbenchStore((s) => s.settings);
  const patchSettings = useWorkbenchStore((s) => s.patchSettings);
  const setTabType = useWorkbenchStore((s) => s.setTabType);
  const applyFormat = useWorkbenchStore((s) => s.applyFormat);
  const updateTab = useWorkbenchStore((s) => s.updateTab);
  const toast = useWorkbenchStore((s) => s.toast);
  const setSettingsOpen = useWorkbenchStore((s) => s.setSettingsOpen);

  const options = {
    indent: settings.indentSize,
    attributeWrapThreshold: settings.attributeWrapThreshold,
  };

  const convert = () => {
    if (!tab) return;
    void (async () => {
      try {
        const { convertJsonTabToXml, convertXmlTabToJson } = await import(
          '../utils/convert'
        );
        if (tab.type === 'xml') {
          const result = convertXmlTabToJson(tab.formatted || tab.raw, options);
          updateTab(tab.id, { type: 'json', raw: result.formatted });
          applyFormat(tab.id, result);
          toast('success', 'Converted XML to JSON');
        } else {
          const result = convertJsonTabToXml(tab.formatted || tab.raw, options);
          updateTab(tab.id, { type: 'xml', raw: result.formatted });
          applyFormat(tab.id, result);
          toast('success', 'Converted JSON to XML');
        }
      } catch (err) {
        toast('error', err instanceof Error ? err.message : 'Conversion failed');
      }
    })();
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">{'</>'}</span>
        <span className="brand-name">XML Workbench</span>
      </div>
      {tab && (
        <div className="segmented" role="radiogroup" aria-label="Tab type">
          <button
            type="button"
            role="radio"
            aria-checked={tab.type === 'xml'}
            className={tab.type === 'xml' ? 'on' : ''}
            onClick={() => setTabType(tab.id, 'xml')}
          >
            XML
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={tab.type === 'json'}
            className={tab.type === 'json' ? 'on' : ''}
            onClick={() => setTabType(tab.id, 'json')}
          >
            JSON
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={tab.type === 'list'}
            className={tab.type === 'list' ? 'on' : ''}
            onClick={() => setTabType(tab.id, 'list')}
          >
            List
          </button>
        </div>
      )}
      <div className="topbar-actions">
        {tab?.type !== 'list' && (
          <button type="button" onClick={convert} disabled={!tab}>
            {tab?.type === 'json' ? 'Convert to XML' : 'Convert to JSON'}
          </button>
        )}
        <button
          type="button"
          aria-label="Toggle theme"
          onClick={() =>
            patchSettings({
              theme: settings.theme === 'dark' ? 'light' : 'dark',
            })
          }
        >
          {settings.theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <button type="button" onClick={() => setSettingsOpen(true)}>
          Settings
        </button>
      </div>
    </header>
  );
}
