# Run TacLens without Node.js

**Node.js is not required to run TacLens.** The application runs entirely in your browser when you open `index.html` directly or visit a statically hosted copy. No terminal, npm install, server, account or API key is needed for browser-only use.

## Quick start

1. Fully extract the browser download into a folder.
2. Open `index.html` in your desktop browser. Direct-file operation is tested with Microsoft Edge.
3. To try the synthetic data, open **Settings → Workspaces & backups → Import layers / backups**, choose `examples/operations-showcase-workspace.json`, review the preview and select **Add layers**. Use an empty workspace for the example.
4. Create and edit layers, compare mappings and export reports as usual.
5. Export JSON backups from Settings to keep a portable copy of your work.

Keep the app files together. Moving only `index.html` breaks its relative CSS and JavaScript references. Do not open it from inside an unextracted ZIP.

## Files you need

These 11 files are required for the application, all beside `index.html`:

| File | Purpose |
| --- | --- |
| `index.html` | Open this file to launch the app. |
| `styles.css` | App layout and themes. |
| `data.js` | Bundled ATT&CK catalog, including its attribution. |
| `core.js` | Mapping, coverage and workspace logic. |
| `work-ui.js` | Work tracking and coverage review interfaces. |
| `work-report.js` | Work tracker in exported reports. |
| `insights.js` | Analysis views and evidence summaries. |
| `matrix.js` | Interactive matrix and technique previews. |
| `elt-report.js` | Executive report generation. |
| `storage.js` | Browser storage and the optional local-server connection. |
| `app.js` | Main application and analyst report generation. |

Also keep `favicon.ico` for the browser-tab icon, and include `LICENSE-ATTACK.txt` when distributing the bundled ATT&CK data. The testing workspace is optional.

```text
TacLens/
  index.html
  styles.css
  data.js
  core.js
  work-ui.js
  work-report.js
  insights.js
  matrix.js
  elt-report.js
  storage.js
  app.js
  favicon.ico
  LICENSE-ATTACK.txt
  examples/
    operations-showcase-workspace.json   (optional testing data)
```

You do not need `server.cjs`, `workspace-store.cjs`, `package.json`, `scripts/`, `tests/`, `.github/`, `node_modules/` or the original `enterprise-attack.json` download to run the browser-only app. The compiled catalog is already in `data.js`.

## Where your work is saved

Browser-only mode stores your work in that browser's local storage. It supports multiple workspaces, layer editing, tags, users, work tracking, Analysis, coverage reviews, JSON imports/exports and both HTML report formats. It does not write automatically into folders on your computer or a network share.

Use the same browser and location for continued work, and keep exported JSON backups. Clearing browser data or changing browsers or app locations can make the previous browser-stored workspace unavailable. JSON imports let you move your work between copies of the app.

The optional Node.js server adds automatic workspace files on disk, configurable local/network folders and shared-folder synchronization. Node.js is also used for development tests and catalog/example generation. None of these Node.js steps is needed to open the browser-only app or an exported report.

## Static hosting and GitHub Pages

These same browser files can be served by a static host. Visitors open its published URL and use browser storage, without installing Node.js. Keep the filenames and relative layout above when hosting under a repository subpath.

The full GitHub package includes an optional Pages workflow. Its Node.js build runs on GitHub's runner, not on visitors' computers. You can instead publish the already-prepared browser files without running a local build.

## Opening an exported report

An exported analyst or ELT report is a single standalone HTML file. Open that one file in your browser; the app folder and Node.js are not needed. Reports retain their exported interactive views and are read-only. To edit mappings, open the app and import a JSON workspace or layer export.
