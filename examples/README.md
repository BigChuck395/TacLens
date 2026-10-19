# Synthetic testing workspace

Import `operations-showcase-workspace.json` through **Settings → Workspaces & backups → Import layers / backups**. Import into an empty workspace. Every layer, mapping note, rule reference, tag, user and work item in this file is generated from `scripts/build-showcase.cjs` and is illustrative.

The file is generated independently of saved user workspaces. Names of tools, teams, controls and people do not identify real deployments or individuals.

| Technique | Example behavior in the tool |
| --- | --- |
| T1059.001 | Detection and control present across several tools; no open deficiency. |
| T1059.003 | Overlapping intelligence with no confirmed defense. |
| T1003.001 | Reviewed detection-only protection and accepted coverage. |
| T1567.002 | Architectural protection without a detection tool mapping. |
| T1078 | Detection present; intelligence coverage review pending. |
| T1082 | Defense recorded, but a scheduled intelligence source review is overdue. |
| T1486 | Multiple open deficiencies with only one source in progress. |
| T1105 | Different intelligence sources with covered, pending and uncovered decisions. |
| T1041 | All actionable sources tracked in progress; deprioritized in Needs work. |
| T1021.001 | Defense recorded and tracked work ready to close. |
| T1547.001 | Work returned to the queue with notes preserved. |
| T1005 | An assignment to a fictional deleted user. |
| T1110.003 | An upcoming scheduled intelligence source review. |
| T1027 | Closed deficiency and intelligence work history. |
| T1059.004 | A previous coverage decision becomes pending after detection evidence changes. |

The layer library demonstrates folders, subfolders, filtering, active/deleted tags and an archived hidden intelligence layer. Reports export selected layers only. In-progress work remains available for all saved layers in the app.

Run `npm run build:example` to regenerate this file, or `node scripts/build-showcase.cjs YYYY-MM-DD` for reproducible relative dates. Generation never installs, reads or replaces saved workspace data.
