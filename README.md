# XML Workbench

Client-side workbench for developers who paste messy, single-line XML (often from logs) and need it formatted, explored as a tree, and kept across tabs. JSON formatting is included. Nothing is sent to a server.

## Run

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm test
npm run lint
npm run build
npm run preview
```

Open the production preview at http://127.0.0.1:4173/

## Production deploy

This is a static SPA (`dist/`). No backend is required.

```bash
npm ci
npm run build
```

Serve the `dist` folder with any static host. Config is included for:

- **Netlify** — `netlify.toml`
- **Vercel** — `vercel.json`
- **GitHub Pages / subpath** — `BASE_PATH=/your-repo/ npm run build`

CI runs lint, tests, and the production build on push (`.github/workflows/ci.yml`).

Security headers (nosniff, frame deny, referrer policy) are set for Vite preview, Netlify, and Vercel. Large documents are not stored as trees in `localStorage`; field size is capped so quota errors cannot brick the app.

## Features

- Independent XML, JSON, or List tabs with rename, reorder, close, and localStorage persistence
- List mode: paste one value per line (or comma-separated) and wrap as `'value',` rows for SQL / IN clauses
- Custom XML pretty-printer (DOMParser + recursive printer): declarations, comments, CDATA, namespaces, mixed content
- Extracts XML/JSON from log prefixes and suffixes
- Detects escaped / double-encoded payloads with **Unescape and format**
- Malformed XML: error line/column, editor jump, best-effort lenient indent
- Formatting runs in a Web Worker with a loading state
- Split editor + virtualized tree, two-way selection sync, XPath / JSON path
- Convert XML ↔ JSON
- Dark mode default, light theme, persisted settings

## Shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl/Cmd+T | New tab |
| Ctrl/Cmd+W | Close tab |
| Ctrl/Cmd+Tab | Next tab |
| Ctrl/Cmd+Shift+Tab | Previous tab |
| Ctrl+PageDown / PageUp | Next / previous tab |
| Ctrl/Cmd+F | Find in the editor |
| Double-click tab | Rename |
| Middle-click tab | Close |
| Tree arrows | Move / expand / collapse |
| Enter in tree | Select node |

## Samples

Paste from `samples/`:

- `soap-order.xml` — single-line SOAP with namespaces, comments, CDATA
- `log-line.txt` — log prefix/suffix wrapping XML
- `malformed.xml` — unclosed tags
- `large-nested.xml` — nested catalog for tree performance
- `order.json` — compact JSON order payload
- `ids.txt` — one id per line for List mode (`'id',`)

## Project structure

```
src/
  components/     layout, editor, tree, dialogs
  features/xml    XML format entry points
  features/json   JSON format entry points
  store/          Zustand workbench + tab helpers
  utils/          formatters, extractors, xpath, convert
  workers/        format Web Worker
  types/          shared Tab / tree models
samples/
```

Core logic lives in framework-free utils (`xmlFormatter.ts`, `xmlToTree.ts`, `jsonFormatter.ts`, `extractPayload.ts`, `xpath.ts`) and is covered by Vitest.
