# TacLens

An ATT&CK workspace for SOC, intelligence, red and purple teams. Compare detection tools, deficiencies and intelligence using categorical coverage assessments, then export detailed analyst reports or a concise executive matrix.

This distribution contains application code and generated testing data. It includes no saved user workspaces, personal mappings, reports, backups or Git history.

## Run without Node.js

**You do not need Node.js, npm, a terminal or a local server to run TacLens.** Extract the download and open `index.html` directly in your browser. You can also use it on a static host such as GitHub Pages.

1. Download and fully extract the ZIP. Do not open `index.html` from inside the ZIP viewer.
2. Keep the HTML, CSS and JavaScript files together in the same folder.
3. Double-click `index.html`, or use your browser's **Open file** command. Direct-file operation is tested with Microsoft Edge.
4. Create layers or import the included testing workspace through **Settings → Workspaces & backups → Import layers / backups**.
5. Use the same browser for saved work. Use **Export current workspace** or **Export all workspaces** in Settings for portable JSON backups.

The browser app includes the matrix, layer editing, Analysis, coverage review, work tracking, JSON import/export and HTML report generation. Desktop Chrome and Edge can also save workspaces directly to a folder you approve, without Node.js or either `.cjs` file. Firefox uses browser storage and JSON import/export; automatic folder saves in Firefox require the optional local server.

To save directly to disk in Chrome or Edge:

1. Open **Settings → Storage → Save workspace to folder**, or **Manage workspaces → Save to folder**.
2. Choose a parent folder in the browser's folder picker and approve read/write access.
3. Review the destination and select **Save here**. TacLens creates a subfolder named with the workspace's ID. Future edits save to `workspace.json`; after changes, `workspace.backup.json` holds the previous version.
4. To reopen saved files, select **Open saved workspace folder** and choose the subfolder containing `workspace.json`.

The browser remembers folder connections and keeps a recovery copy. If folder permission expires, use **Reconnect folder**. Folder files remain independent of browser storage; clearing browser data removes remembered connections, which you can restore by opening the saved folder. Workspaces without a chosen folder remain in browser storage. A network folder can be used if it is available in the browser's picker. Use one active editor per shared workspace; changed-file checks catch stale saves but do not provide a multi-user database.

See [BROWSER-ONLY.md](BROWSER-ONLY.md) for the exact file list, a minimal folder layout and the difference between opening the app and opening an exported report.

## Optional local server for folder storage

The optional server provides folder storage across browsers, including Firefox. It is not required for direct folder saves in desktop Chrome and Edge. To use the server, install Node.js 24 or later and run:

```sh
node server.cjs
```

Open **http://127.0.0.1:5173/**. No dependency installation, account, API key or build step is required. The server listens on the local loopback interface. In this optional mode, workspaces save under `workspaces/`, which is ignored by Git. The first launch starts empty.

Keep `server.cjs` and `workspace-store.cjs` beside the browser application files listed in [BROWSER-ONLY.md](BROWSER-ONLY.md). You can also start the server with `npm start`.

Settings provides theme selection, tag management, workspace exports and cleanup. Manage workspaces can create, rename, delete or open saved workspaces. With the local server, each workspace can use its own folder, including a mapped network drive or UNC path. Keep one active writer per shared workspace; directory locking and stale-save checks help prevent overwrites.

## Import the testing workspace

No Node.js is needed to import the included example layers:

1. Open **Settings → Workspaces & backups → Import layers / backups**.
2. Select [`examples/operations-showcase-workspace.json`](examples/operations-showcase-workspace.json).
3. Review the preview and confirm the import. Layer imports create new layer identities, so review coverage decisions in their new scope.
4. Open Landscape, Matrix, Analysis, Coverage review and In progress to explore the examples.

Use an empty workspace when importing the example so duplicate tool layers do not inflate counts. The example has 32 synthetic layers, over 1,000 mappings, nested folders, tags, fictional users and work history. It demonstrates multiple detection tools, resolved and open deficiencies, independent intelligence coverage reviews, architectural protection and scheduled source reviews. See [examples/README.md](examples/README.md) for useful technique IDs.

Import the example manually when you want to try it. Normal startup never seeds testing data, and there is no demo reset button.

## Coverage model

- Each detection tool layer counts once for an exact technique. Optional rule names do not increase the tool count. Detection mappings are always positive evidence.
- Deficiencies are open with **Nothing present** and resolved when a detection, compensating control or both is recorded on that assessment.
- Intelligence also supports **Not reviewed**. When detections are present, review whether they cover the behavior described by each intelligence source. An uncovered intelligence mapping does not negate the detection tool mapping.
- Parent and sub-technique evidence remain independent. Unmapped parents may appear as context for mapped children. The executive report rolls those mappings into parent tiles, with the highest-priority issue determining each color.

The app and analyst report matrices grow down the page, preserve full technique names and keep expandable sub-techniques, hover previews and detailed source evidence. Optional full-page mode scrolls when needed. ELT reports show parent tiles with hover or click details and sub-technique dispositions.

## Reports and backups

**Export HTML report** is available from the main pages. Choose Standard for the analyst report or ELT for the executive report. Analysis and the work tracker are optional where applicable. Reports include the selected layers and open offline as read-only files.

JSON workspace exports preserve editable data, including hidden layers. Keep reports and workspace exports outside the repository or in the ignored `reports/` and `backups/` folders.

## ATT&CK catalog and attribution

The bundled catalog is in `data.js`. MITRE's ATT&CK content retains its [license and attribution](LICENSE-ATTACK.txt). ATT&CK is a registered trademark of The MITRE Corporation. This package does not choose or change a license for the application source.

The ATT&CK catalog is bundled in `data.js`; no download or generation step is needed to run the app.
