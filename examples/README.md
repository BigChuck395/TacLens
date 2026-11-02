# Synthetic testing workspace

Import `operations-showcase-workspace.json` through **Settings → Workspaces & backups → Import layers / backups**. Import into an empty workspace. All layers, notes, rule IDs, users, decisions and work items are synthetic.

Generated on November 2, 2026, this example contains 28 layers, 434 mapping records and 270 mapped ATT&CK techniques in its default selection. It documents 81 D3FEND techniques across Model, Harden, Detect, Isolate, Deceive, Evict and Restore. One detection layer is hidden and one intelligence layer is archived, so selecting or restoring those layers changes the totals.

| Technique | What to explore |
| --- | --- |
| T1059.001 — PowerShell | Two findings in one assessment layer: a managed-workstation test has both defenses; an unmanaged-endpoint scenario stays open with no logging and tracked work. Two SIEM rules still count as one tool layer. Three detection tool layers map this technique. One intelligence scenario awaits review while another has confirmed coverage. |
| T1003.001 — LSASS Memory | Multiple positive tool mappings coexist with a reviewed intel scenario outside their managed-host scope. That source remains without coverage. Process-analysis and isolation techniques are documented separately. |
| T1110.003 — Password Spraying | Identity analytics and account-locking controls were assessed together. The intelligence mapping has an explicit covered detection review. |
| T1078.004 — Cloud Accounts | A training-tenant intelligence risk is accepted without recording a defense. Access modeling and credential-revocation references do not turn it green. |
| T1685.005 — Clear Windows Event Logs | An open finding has no logging or confirmed defense. File-integrity monitoring and configuration recovery are analyst-selected options for this newer ATT&CK ID, not inferred coverage. |
| T1059.002 — AppleScript | Intelligence is marked Not related because its operating-system population is outside this synthetic scope. It remains visible as attack context. |
| T1053.005 — Scheduled Task | A duplicate intelligence source is dismissed. Its saved reference does not imply coverage. |
| T1486 — Data Encrypted for Impact | A bounded replay validates detection and recovery for a managed file service. Restore File and Restore Disk Image document the recovery methods. |
| T1490 — Inhibit System Recovery | An older, open management-plane finding has no confirmed defense and an active engineering work item. Modeling and recovery references describe the investigation. |
| T1005 — Data from Local System | A decoy-file access alert demonstrates Deceive techniques without claiming a prevention control. |
| T1046 — Network Service Discovery | Network-node inventory, logical-link mapping and access modeling document test scope. The finding stays open because modeling alone does not establish protection. |

In **D3FEND matrix**, select **Documented in selected layers** to see the defensive techniques used by these scenarios. Blue means documented, not automatically implemented or effective. Select a tile to inspect exact source mappings, then switch the layer selection to see the highlights update.

The library includes nested folders, a deleted tag that needs attention in Settings, an unselected lab detection layer and an archived legacy intelligence source. The intelligence review page includes both overdue and upcoming schedules; other sources remain indefinite. **In progress** includes active, queued and closed work, with role-based assignments and notes. **Recent changes** contains illustrative documentation and archive events.

Restore the archived source from the library's **Archived layers** filter. Its mappings and old review schedule are retained. Reports include selected active layers only and preserve documented D3FEND references.

This file is generated independently of saved user workspaces. Normal startup never installs or replaces mock data, and there is no demo reset button.