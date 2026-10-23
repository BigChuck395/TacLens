# Synthetic testing workspace

Import `operations-showcase-workspace.json` through **Settings → Workspaces & backups → Import layers / backups**. Import into an empty workspace. Every layer, mapping note, rule reference, tag, user and work item in this file is synthetic and illustrative.

The file is generated independently of saved user workspaces. Names of tools, teams, controls and people do not identify real deployments or individuals.

| Technique | Example behavior in the tool |
| --- | --- |
| T1685.005 | Same TTP mapped twice in one Opportunities layer: wevtutil has both defenses; the PowerShell scenario stays open and has its own work item. Detection and intelligence layers also demonstrate separate scenarios. Logging is present for wevtutil and absent for the PowerShell scenario, producing a mixed logging badge. |
| T1546.017 | An accepted lab risk closes the opportunity in slate blue, with a dated acceptance note and no implied detection or control. |
| T1059.001 | Detection and control present across several tools; no open opportunity. |
| T1059.003 | Overlapping intelligence with no confirmed defense. |
| T1003.001 | Reviewed detection-only protection and accepted coverage. |
| T1567.002 | Architectural protection without a detection tool mapping. |
| T1078 | Detection present; intelligence coverage review pending. |
| T1082 | Defense recorded, but a scheduled intelligence source review is overdue. |
| T1486 | Multiple open opportunities with only one source in progress. |
| T1105 | Different intelligence sources with covered, pending and uncovered decisions. |
| T1041 | All actionable sources tracked in progress; deprioritized in Needs work. |
| T1021.001 | Defense recorded and tracked work ready to close. |
| T1547.001 | Work returned to the queue with notes preserved. |
| T1005 | An assignment to a fictional deleted user. |
| T1110.003 | An upcoming scheduled intelligence source review. |
| T1027 | Closed opportunity and intelligence work history. |
| T1059.004 | A previous coverage decision becomes pending after detection evidence changes. |

The layer library demonstrates folders, subfolders, filtering, active/deleted tags and an archived intelligence layer. Choose **Archived layers** in the library to find it and try **Restore layer**. Reports export selected active layers only. In-progress work is shown for active layers, including unselected ones; archived work stays preserved and returns when its layer is restored.

The example is included as a ready-to-import JSON file. Normal startup starts empty and never installs or replaces saved workspace data.
