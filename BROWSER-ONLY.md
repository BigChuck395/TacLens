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

These 13 files are required for the application, kept together in one folder:

| File | Purpose |
| --- | --- |
| `index.html` | Open this file to launch the app. |
| `styles.css` | App layout and themes. |
| `data.js` | Bundled ATT&CK catalog, including its attribution. |
| `history.js` | Recent layer and mapping edit history. |
| `terminology.js` | Workspace terminology used by app labels and reports. |
| `core.js` | Mapping, coverage and workspace logic. |
| `work-ui.js` | Work tracking and coverage review interfaces. |
| `work-report.js` | Work tracker in exported reports. |
| `insights.js` | Analysis views and evidence summaries. |
| `matrix.js` | Interactive matrix and technique previews. |
| `elt-report.js` | Executive report generation. |
| `storage.js` | Direct folder saves, browser recovery storage and the optional local-server connection. |
| `app.js` | Main application and analyst report generation. |

Also keep `favicon.ico` for the browser-tab icon, and include `LICENSE-ATTACK.txt` when distributing the bundled ATT&CK data. The testing workspace is optional.

```text
TacLens/
  index.html
  styles.css
  data.js
  terminology.js
  core.js
  history.js
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

You do not need `server.cjs`, `workspace-store.cjs`, `package.json`, `.github/`, `node_modules/` or the original `enterprise-attack.json` download to run the browser-only app. The catalog is already in `data.js`.

## Where your work is saved

The browser app supports multiple workspaces, layer editing, tags, users, work tracking, Analysis, coverage reviews, JSON imports/exports and both HTML report formats.

| Browser | Saving workspaces without a server |
| --- | --- |
| Desktop Chrome or Edge | Automatic saves to a folder you approve, plus a browser recovery copy. |
| Firefox and browsers without a folder picker | Browser storage and manual JSON import/export. |

In Chrome or Edge, open **Settings → Storage → Save workspace to folder**. Choose a parent folder, approve read/write access, review the destination and select **Save here**. TacLens creates a subfolder named with the workspace's ID, then automatically saves `workspace.json` there. The previous version is kept in `workspace.backup.json` after edits. Each workspace can have its own folder. A network location can be used if the browser's picker can access it.

Use **Open saved workspace folder** to reopen a folder containing `workspace.json`, including a workspace previously saved by the local server. The preview shows which workspace will open. If the browser asks for permission again, select **Reconnect folder**. A stale copy cannot silently replace a detected external edit; reopen the saved version or save your edits to a different folder. Use one active editor per shared workspace.

Folder connections and a recovery copy are remembered in browser storage. Clearing browser data removes those connections and browser-only workspaces, but leaves your selected folder files intact. Reopen saved folders to reconnect them. Keep JSON exports for portable backups. Removing a linked workspace from the app keeps its saved folder.

Firefox does not currently support automatic writes to a selected folder through this browser API. For automatic folder storage in Firefox, keep `server.cjs` and `workspace-store.cjs` beside the browser application files, run `node server.cjs` and open **http://127.0.0.1:5173/**. No dependency installation is needed. Direct folder saves in Chrome and Edge and exported reports do not require this server.

## Static hosting and GitHub Pages

These same browser files can be served by a static host. Visitors open its published HTTPS URL without installing Node.js. Direct folder saves are available in supported browsers after the visitor approves access; other browsers retain JSON import/export. Keep the filenames and relative layout above when hosting under a repository subpath.

The repository includes an optional Pages workflow that copies the browser files and included synthetic example directly, without Node.js or a build step. To use it, set **Settings → Pages → Source** to **GitHub Actions**, then open **Actions → Publish GitHub Pages → Run workflow**. Publishing runs only when you start that workflow. You can also upload the browser files to another static host.

## Opening an exported report

An exported analyst or ELT report is a single standalone HTML file. Open that one file in your browser; the app folder and Node.js are not needed. Reports retain their exported interactive views and are read-only. To edit mappings, open the app and import a JSON workspace or layer export.
