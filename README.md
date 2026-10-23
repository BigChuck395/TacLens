# TacLens

An ATT&CK workspace for SOC, intelligence, red and purple teams. Compare detection tools, opportunities and intelligence using categorical coverage assessments, then export detailed analyst reports or a concise executive matrix.

**Live app:** [Launch TacLens](https://bigchuck395.github.io/TacLens/) — no installation required. Workspaces stay in your browser or folders you approve.

This distribution contains application code and generated testing data. It includes no saved user workspaces, personal mappings, reports, backups or Git history.

**Development note:** TacLens was developed with AI assistance for coding, testing and documentation, guided by human direction and iterative feedback.

## How to use TacLens

1. **Create a workspace.** Use **Switch / manage workspaces** to keep separate assessments or teams in their own workspaces. You can also import the included testing workspace to explore the tool.
2. **Add your layers.** Open **Layer library → Add a layer** and choose Detection coverage, Opportunities or Threat intelligence. Use a detection layer for each tool, and separate assessment or intelligence layers by source. Give layers meaningful names and organize them with folders and tags.
3. **Map techniques.** Open a layer's mapping editor, select individual techniques or bulk-select a group, then apply your evidence. Record the defense for opportunity and intelligence mappings, with a review date and optional notes.
4. **Review coverage.** Use **Landscape** for totals, **ATT&CK matrix** to explore techniques, and **Analysis** to find outstanding work. **Coverage review** helps verify existing protection and review intelligence sources when due.
5. **Track action.** Select **Start work** to assign a mapping and add progress notes. Use **Record defense** when protection changes, then close the tracked work once its coverage is confirmed.
6. **Save and share.** In Chrome or Edge, [choose a workspace folder](#save-workspaces-to-folders) for automatic disk saves. You can also export a JSON backup. Use **Export HTML report** for a detailed analyst report or a concise ELT report.

Select or deselect layers in the library to change the evidence included in comparisons and reports. JSON backups preserve editable workspace data; HTML reports are read-only snapshots.

### Customize assessment terminology

Open **Settings → Terminology** to replace the default **Finding / Findings** labels for the current workspace. Enter singular and plural forms, such as **Gap / Gaps**, **Opportunity / Opportunities**, or **Deficiency / Deficiencies**, then select **Save terminology**. The app, layer type labels, matrix, analysis, work tracker and exported HTML reports use your wording. **Restore defaults** returns to Finding / Findings.

Each workspace keeps its own labels. Custom layer names, folders, notes, mapping identities and coverage decisions stay as entered. Workspace folders and JSON backups retain the setting. When importing a workspace or layer file that includes terminology, the import preview lets you choose whether to adopt those labels; older files continue to work with the current workspace's terminology.

### Archive layers

Use **Archive** on a layer in the Layer library, or **Archive layer** in its settings. For intelligence, you can also archive directly from **Coverage review → Intelligence reviews** or the review dialog. Archiving keeps the complete layer, including mappings, notes, folders, tags, tracked work and its review schedule. It removes the layer from coverage totals, analysis, work queues, scheduled intelligence reviews and HTML reports.

Choose **Archived layers** in the library's archive filter to find it later, then select **Restore layer**. Restoration selects the layer again; its original review schedule is retained, so an overdue intelligence review becomes due again. Selecting all layers or a folder never restores archived layers. Workspace folders and JSON exports retain archived layers, and Recent changes records archiving and restoration.

## Run without Node.js

**You do not need Node.js, npm, a terminal or a local server to run TacLens.** Extract the download and open `index.html` directly in your browser. You can also use it on a static host such as GitHub Pages.

1. Download and fully extract the ZIP. Do not open `index.html` from inside the ZIP viewer.
2. Keep the HTML, CSS and JavaScript files together in the same folder.
3. Double-click `index.html`, or use your browser's **Open file** command. Direct-file operation is tested with desktop Chrome and Edge.
4. Create layers or import the included testing workspace through **Settings → Workspaces & backups → Import layers / backups**.
5. Use the same browser for saved work. Use **Export current workspace** or **Export all workspaces** in Settings for portable JSON backups.

The browser app includes the matrix, layer editing, Analysis, coverage review, work tracking, JSON import/export and HTML report generation. See [BROWSER-ONLY.md](BROWSER-ONLY.md) for the exact file list and minimal folder layout.

## Save workspaces to folders

**Desktop Chrome and Edge can save directly to local folders from `index.html`. Node.js, `server.cjs` and `workspace-store.cjs` are not needed for this mode.** Approve a folder once, then changes save automatically while access remains available.

| Browser | Open `index.html` directly | Automatic saves to a selected folder |
| --- | --- | --- |
| Desktop Chrome / Edge | Yes | Yes, after granting folder access. |
| Firefox | Yes, with browser storage and JSON import/export. | Requires the [optional local server](#optional-local-server-for-folder-storage). |

### Choose a storage folder

1. Open **Settings → Storage → Save workspace to folder**, or **Manage workspaces → Save to folder**.
2. Choose a parent folder in the browser's folder picker and approve read/write access.
3. Review the destination and select **Save here**. Each workspace gets its own subfolder named with its ID. Repeat for other workspaces as needed.
4. Check that the workspace status says **Saved to selected folder**.

```text
Chosen parent folder/
  <workspace-id>/
    workspace.json          Current layers, mappings, notes and work tracking
    workspace.backup.json   Previous saved version, created after edits
```

Workspaces without a selected folder stay in browser storage. A mapped drive or network folder can be used if the browser's picker can access it. The folder must remain available for automatic saves.

### Reopen, reconnect or change folders

- **Open saved workspace folder:** choose the workspace subfolder containing `workspace.json`, review the preview and select **Open workspace**. Existing folders saved by the local server are compatible. Opening a saved copy replaces the browser recovery copy of that same workspace.
- **Reconnect folder:** restore browser permission if access expires. The browser remembers folder connections and keeps a recovery copy, including edits waiting to be saved.
- **Choose another folder:** save a copy to a different parent folder. Future edits use the new folder; the original copy is kept and is not synchronized.
- **Remove a linked workspace:** removes it from the app's list while keeping its saved files. Clearing browser data also leaves those files intact; reopen their folder to restore the connection.

Use one active editor per shared workspace. Changed-file checks reject detected stale saves; open the saved version or save your edits to a different folder to resolve them. Folder storage does not replace portable JSON backups or provide a multi-user database.

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

Use an empty workspace when importing the example so duplicate tool layers do not inflate counts. The example has 32 synthetic layers, over 1,000 mappings, nested folders, tags, fictional users and work history. It demonstrates multiple detection tools, resolved and open opportunities, independent intelligence coverage reviews, architectural protection and scheduled source reviews. See [examples/README.md](examples/README.md) for useful technique IDs.

Import the example manually when you want to try it. Normal startup never seeds testing data, and there is no demo reset button.

## Coverage model

- Each detection tool layer counts once for an exact technique. Optional rule names do not increase the tool count. Detection mappings are always positive evidence.
- Opportunities are open with **Nothing present** and resolved when a detection, compensating control or both is recorded on that assessment.
- Intelligence also supports **Not reviewed**. When detections are present, review whether they cover the behavior described by each intelligence source. An uncovered intelligence mapping does not negate the detection tool mapping.
- Parent and sub-technique evidence remain independent. Unmapped parents may appear as context for mapped children. The executive report rolls those mappings into parent tiles, with the highest-priority issue determining each color.

The app and analyst report matrices grow down the page, preserve full technique names and keep expandable sub-techniques, hover previews and detailed source evidence. Optional full-page mode scrolls when needed. ELT reports show parent tiles with hover or click details and sub-technique dispositions.

## Reports and backups

**Export HTML report** is available from the main pages. Choose Standard for the analyst report or ELT for the executive report. Analysis and the work tracker are optional where applicable. Reports include the selected layers and open offline as read-only files.

JSON workspace exports preserve editable data, including hidden layers and recent-change history. Keep reports and workspace exports outside the repository or in the ignored `reports/` and `backups/` folders.

## Review recent changes

Open **Recent changes** to see saved edits to layers and individual mappings, including notes, defenses, logging, risk acceptance and tracked work. Expand **What changed** for before-and-after values, or **Open mapping** to revisit that exact scenario. Filter by date, layer or change type, or search changed values. This is an edit history with no review or acknowledgement steps.

Tracking starts with this version; earlier edits cannot be reconstructed. Each workspace keeps up to 500 recent changes, within a 1 MB history limit. Older records roll off and long values appear as excerpts. Workspace folders and JSON workspace backups preserve the history. Selecting layers and navigating do not create new change records. This is a local edit history, not a tamper-proof audit log.

## ATT&CK catalog and attribution

The bundled catalog is in `data.js`. MITRE's ATT&CK content retains its [license and attribution](LICENSE-ATTACK.txt). ATT&CK is a registered trademark of The MITRE Corporation. This package does not choose or change a license for the application source.

The ATT&CK catalog is bundled in `data.js`; no download or generation step is needed to run the app.

### Editing mappings and importing older layers

Open **Edit TTPs** from a layer in the Layer library. Use **Edit mappings** beside a technique to edit its scenario name, notes / description, recorded defense and review date in the same editor. Use **Add another mapping for this TTP** to record another scenario with a different outcome. Each mapping keeps its own notes, coverage review and work history. Check multiple techniques for a bulk change; choose whether to update all their existing mappings or add another mapping for each.

Multiple mappings in one detection tool layer still count as **one detection layer** for that technique. Open opportunities stay visible even when another scenario of the same TTP is resolved. JSON exports preserve every mapping separately.

Older TacLens JSON layers and workspace backups using Deficiencies (including the legacy `hunt` layer type) are migrated to **Opportunities** on import or when opened. Existing notes, dates, assessments and tracked work are kept. New exports use the `opportunity` layer type.

### Accepting opportunity risks

Use **Accept risk** beside an open opportunity in Analysis or the work tracker. Add optional acceptance notes and a date, then close the opportunity. You can also choose **Accept risk** under **Opportunity outcome** in the mapping editor. The mapping stays slate blue as **Risk accepted**, outside the open-work queue and separate from resolved coverage. It does not add detections or compensating controls, and other scenarios or intelligence reviews remain active.

Review these decisions under **Analysis → Filter work or view history → Risk accepted**. To reconsider one, use **Reassess coverage**, or return its outcome to **Assess recorded defenses** in the layer editor. Acceptance dates and notes are preserved in workspace folders, JSON backups and HTML reports.

Detection layers support multiple mappings of the same TTP. Use **Add another detection for this TTP**; each detection mapping has its own name, rules, notes and review date, while the tool layer still counts once in coverage statistics.

### Logging on opportunity mappings

Each opportunity mapping records **Logging present**, **No logging**, or **Not reviewed**. Edit this in the layer mapping editor or the Record defense dialog. Use **Apply logging only** in the bulk editor to update selected mapped TTPs while preserving defenses, accepted risks, notes and dates. **No change** preserves existing logging assessments. Older layers default to Not reviewed.

The ATT&CK matrix shows a logging badge on each assessed technique, even with evidence counts turned off: **green** for Logging present, **red** for No logging, and **purple** for Not reviewed. Collapsed branches show child logging, and neutral **Logs mixed** means the selected layers or scenarios have different assessments. Hover or open a technique to inspect the individual mappings. Analyst and executive reports retain these indicators. Logging stays separate from defense coverage: it does not resolve opportunities, add detections, or change accepted-risk decisions.
