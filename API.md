# TacLens integration API

The API runs in the optional **Node.js 24+ server**, alongside the existing app. No npm dependencies, database, build, cloud service, or subscription are required. The standalone browser app still runs without Node.js. GitHub Pages and a directly opened `index.html` cannot host an API.

## Start and try it locally

1. Keep the application files together, including `reports.js`, `server.cjs`, `workspace-store.cjs`, `api.cjs`, `api-auth.cjs`, and `api-schema.cjs`.
2. Run `node server.cjs` and open `http://localhost:5173/`.
3. Open **Settings → API & integrations → Open API console** (or `/api.html`).
4. Create a named key. Choose **Read only** for reporting or **Read and write** for synchronization. Copy the token immediately; only its SHA-256 digest is saved. Keys are server-wide, covering all of that server's workspaces.
5. Under **Test a request**, send `GET /api/v1/status`, then `GET /api/v1/workspaces`. A newly created key is filled into the request builder for this page only.
6. Before changing an existing workspace, GET `/api/v1/workspaces/{workspaceId}` and use **Use response ETag**. Copy a route from Endpoints, replace its `{...}` IDs, enter the JSON body, and send it. The console never saves tokens in browser storage.

The API reads server-backed workspaces. If the data currently exists only in a browser, export its workspace JSON and import it into the server-backed app first. API changes appear in the app through its existing refresh mechanism; an unsaved, stale editor is asked to reload rather than overwrite them.

## Authentication and permissions

Every `/api/v1/` request needs:

```http
Authorization: Bearer <integration-token>
```

**Read keys** can list, inspect, analyze, and export data, including HTML reports. **Write keys** can also create, change, archive, and delete data. Each integration should have its own key. Revoke a named key in the local console to disable it immediately. Keys persist in `.api-keys.json` inside the server's workspace storage directory, outside the public file allowlist. Keep this file private and out of Git.

There are no per-workspace permissions in this version. Use separate server instances and storage directories if integrations must be isolated. API access does not authorize arbitrary filesystem access, opening folder paths, or changing server configuration. The editor's legacy storage/folder endpoints and key-management endpoints are restricted to direct, same-origin loopback requests.

For an unattended deployment, `TACLENS_API_TOKEN` optionally supplies one write token. Use at least 32 random URL-safe characters without spaces. This token is not listed as a named key; remove the environment variable and restart to revoke it. Never put tokens in URLs, workspace JSON, reports, or source files.

## Connect from other computers

The default listener is `127.0.0.1:5173`. To listen on a network interface, configure **HTTPS and an API key**. No firewall rules or network listeners are opened by the app's console.

Example in PowerShell, using a certificate issued by a CA your clients trust:

```powershell
$env:TACLENS_HOST = '0.0.0.0'
$env:PORT = '8443'
$env:STRATA_STORAGE_DIR = 'D:\TacLens\workspaces'
$env:TACLENS_TLS_KEY = 'D:\TacLens\certificates\server-key.pem'
$env:TACLENS_TLS_CERT = 'D:\TacLens\certificates\server-chain.pem'
node server.cjs
```

Create keys while using the same storage directory locally before switching to network mode, or supply `TACLENS_API_TOKEN` from your service's secret configuration. The server refuses a network listener without both TLS and a configured key. Clients use `https://your-server:8443/api/v1/` and verify the server certificate. The app editor and key management remain available only on the server computer, using `https://localhost:8443/` with a certificate covering that name. Allow only the intended integration clients through your host/network firewall.

Alternatively, run a TLS reverse proxy on the same machine. Keep TacLens bound to `127.0.0.1`, set `TACLENS_TRUST_PROXY=1`, and proxy **only `/api/v1/*`**, setting `X-Forwarded-Proto: https` and removing client-supplied forwarding headers. Do not proxy the editor or `/api/integrations`. With trust-proxy disabled, forwarded HTTP requests are rejected. Never expose the loopback backend port directly.

Server-to-server clients do not need CORS. For a browser integration hosted elsewhere, set `TACLENS_API_ORIGINS` to a comma-separated list of exact HTTPS origins, for example `https://soc.example.internal`. No wildcard origins or cookie credentials are allowed. CORS does not replace the Bearer token.

## Resources

All paths below start at `/api/v1`. Browse the complete, generated **OpenAPI 3.1** contract in the console, at local `/api/openapi.json`, or with authentication at `/api/v1/openapi.json`. It can be imported into an API client such as Postman.

| Resource | Operations |
| --- | --- |
| `/status` | API version, ATT&CK version and capabilities. |
| `/catalog/tactics`, `/catalog/techniques` | Browse/search the offline ATT&CK catalog; inspect a technique by ID. |
| `/workspaces` | List workspace summaries; create a workspace. |
| `/workspaces/import` | Import an exported workspace as a new workspace; legacy layer types migrate. |
| `/workspaces/{w}` | Read, rename, change terminology/colors, or remove a workspace. The last workspace cannot be removed. |
| `/workspaces/{w}/export` | Download editable workspace JSON. |
| `/workspaces/{w}/layers` | List/filter layers; create a detection, finding or intel layer. |
| `/workspaces/{w}/layers/import` | Import layer JSON using `{"layers": [...]}`; imported layers get new IDs. |
| `/workspaces/{w}/layers/order` | Set the full layer order with `PUT {"ids": [...]}`. |
| `/workspaces/{w}/layers/{l}` | Read, edit metadata/folder/selection, archive/restore, or delete a layer. |
| `/workspaces/{w}/layers/{l}/export` | Download one editable layer as JSON. |
| `/workspaces/{w}/layers/{l}/mappings` | List or create mappings, including several scenarios for the same TTP. |
| `.../mappings/bulk` | Add up to 1,000 mappings in one validated save. A validation failure saves none of the batch. |
| `.../mappings/{m}` | Read, edit or remove an exact mapping. Mapping and ATT&CK IDs are immutable. |
| `.../mappings/{m}/defense` | Record detection, compensating control, both, none, or intel not reviewed. |
| `.../mappings/{m}/decision` | Accept risk, dismiss, mark intel not related, or reopen. |
| `.../mappings/{m}/intel-review` | Confirm whether selected tool layers cover that intelligence scenario. |
| `.../mappings/{m}/work` | Start, assign, add notes, close, or return tracked work to the queue. |
| `/workspaces/{w}/coverage` | Coverage results with evidence and counts; append `/T1059.001` for one exact TTP. |
| `/workspaces/{w}/landscape` | Tactic statistics and mapping assessments. |
| `/workspaces/{w}/analysis` | Prioritized Needs work by default; use `view=all` for all mapped analysis. |
| `/workspaces/{w}/reviews` | Single-defense reviews and intelligence review schedules. POST to `.../reviews/{techniqueId}` to accept/reopen a coverage review. |
| `/workspaces/{w}/work` | Tracked work with assignees, notes, history and closure readiness. |
| `/workspaces/{w}/changes` | Recent changes; API edits name the integration in the change title. |
| `/workspaces/{w}/tags`, `/users`, `/folders` | List, create and remove definitions. Deleted tags/users retain their deleted labels on existing metadata/assignments. |
| `/workspaces/{w}/reports` | POST report options to download an offline analyst or ELT report. Read keys can export reports. |

Lists use `limit` (default 100, maximum 500) and `offset` (default 0). Responses contain `data` and `meta`; list metadata includes `total`, `limit`, and `offset`. Resource IDs are UUIDs. Percent-encode tag/user/folder names in URL segments, including `/` as `%2F` for nested folder paths. Folder deletion refuses non-empty folders unless `recursive=true`, which removes the folder tree and moves its layers to Unfiled without deleting them.

Coverage, Landscape, and Analysis default to selected, unarchived layers. Use `scope=all` to include hidden active layers, or `layerIds=id1,id2` for an explicit set. Archived layers remain excluded. Layer-list filters include `search`, `type`, `folder`, `tag`, `visible`, and `archived`. Analysis supports `sort=priority|intelNewest|intelOverlap|oldestOpportunity|fewestDetections`, plus `intelDays`, `intelOverlap`, `openDays`, `detections=0|1|2+|5+`, and `progress=all|hide|only`. The OpenAPI contract lists parameters for every endpoint.

## Write safely with ETags

GET a workspace first and copy its `ETag` header, including quotation marks. Send it as `If-Match` on every edit under that workspace. The response supplies the new ETag. Creating/importing a workspace instead uses the ETag from GET `/workspaces`. ETags include saved file contents, so edits from the UI or another computer invalidate stale writes.

```http
GET /api/v1/workspaces/WORKSPACE_UUID
Authorization: Bearer <integration-token>

PATCH /api/v1/workspaces/WORKSPACE_UUID/layers/LAYER_UUID/mappings/MAPPING_UUID
Authorization: Bearer <integration-token>
Content-Type: application/json
If-Match: "etag-from-the-workspace-get"

{"notes":"Validated during the replay.","compensatingControl":"both","logging":"present"}
```

An edit without If-Match returns **428**; a stale ETag returns **412**. On 412, reload the current workspace, reconcile your intended edit, and retry. Do not automatically overwrite newer data. Concurrent saves are serialized and use the same directory locks and changed-file checks as the app. These checks do not turn folder storage into a distributed database or promise crash-atomic transactions across several files; use one server process per storage directory.

Creating a workspace, layer, or mapping accepts an optional client-generated UUID `id`; retrying the same ID returns **409** instead of creating another copy. Bulk requests are validated together. Other errors use `{ "error": { "code", "message", "requestId" } }`. Common statuses are 400 validation, 401 invalid key, 403 permission/origin, 404 missing resource, 409 conflict, 413 oversized body, 415 content type, and 429 repeated authentication failures. JSON bodies are limited to 10 MiB; large layer collections can be sent as several batches. Request IDs are also returned in `X-Request-Id`.

## Mapping examples

Finding layer types use the stable API name **`opportunity`** regardless of the workspace's chosen display label. Import also accepts the older deficiency/hunt names. Canonical types are `opportunity`, `detection`, and `intel`.

Add two detection mappings to one tool layer:

```json
{
  "mappings": [
    {"techniqueID":"T1059.001","name":"Encoded command","detections":["SIEM-001"],"notes":"Encoded PowerShell execution."},
    {"techniqueID":"T1059.001","name":"Suspicious script","detections":["SIEM-002"],"notes":"Script behavior monitoring."}
  ]
}
```

POST that body to `.../layers/{layerId}/mappings/bulk`. Both mappings remain separate; this tool contributes **one detection layer**, not two, to that technique's coverage count.

Create a finding with POST `.../mappings`:

```json
{"techniqueID":"T1070.001","name":"Cleared Security log","compensatingControl":"none","logging":"present","notes":"Specific replay scope."}
```

`compensatingControl` values are `none`, `control`, `detection`, `both`, and, for intel only, `unknown`. A finding automatically resolves when a defense is recorded; logging alone does not resolve it. Detection mappings always remain positive. Use `outcome=accepted|dismissed|assess`, or the decision endpoint, for risk/review decisions. Intel also permits `not_related`. Risk acceptance closes work without adding defense coverage. Write the specific mapping ID so another scenario of the same TTP is unaffected.

POST `{"decision":"covered"}` to an intel mapping's `/intel-review` endpoint after checking its behavior against the selected detection layers. `uncovered` and `pending` are the other decisions. A tool mapping on the same technique is not automatically proof that it covers that source's behavior. Record assessments with `/defense`; defaults use today's UTC date. Dates may be provided as `YYYY-MM-DD`.

POST `{"action":"start","assignee":"Analyst","note":"Replaying this scenario."}` to `/work`, then `add_note`, `assign`, `queue`, or `close`. Create the assignee under `/users` first. Closing retains the same coverage/readiness requirements as the app.

## Export reports

POST to `/workspaces/{workspaceId}/reports`:

```json
{"format":"elt","title":"Monthly coverage review","theme":"light","includeWorkTracker":true}
```

The response is downloadable `text/html`, generated by the same report builders as the app. `format=standard` produces the analyst report, starting on Landscape with collapsed sub-techniques. `includeAnalysis` defaults to true for standard reports; set it to false to omit Analysis. ELT retains the executive matrix. `includeWorkTracker` defaults to false. Both support `context`, `theme`, `scope`, and `layerIds`. Export does not change the workspace or require a write key.

## PowerShell client example

Store a copied key in a secret manager/environment variable rather than hardcoding it. This example reads the first workspace, selects a detection layer, and adds a scenario using its current ETag:

```powershell
$apiBase = 'https://your-server:8443/api/v1'
$apiHeaders = @{ Authorization = "Bearer $env:TACLENS_CLIENT_TOKEN" }
$apiWorkspaces = Invoke-RestMethod "$apiBase/workspaces" -Headers $apiHeaders
$apiWorkspaceId = $apiWorkspaces.data[0].id
$apiWorkspace = Invoke-RestMethod "$apiBase/workspaces/$apiWorkspaceId" -Headers $apiHeaders
$apiLayer = $apiWorkspace.data.layers | Where-Object type -eq 'detection' | Select-Object -First 1
$apiWriteHeaders = $apiHeaders.Clone()
$apiWriteHeaders['If-Match'] = $apiWorkspace.meta.etag
$apiBody = @{ techniqueID = 'T1059.001'; name = 'New scenario'; detections = @('SIEM-003') } | ConvertTo-Json
Invoke-RestMethod "$apiBase/workspaces/$apiWorkspaceId/layers/$($apiLayer.id)/mappings" `
  -Method Post -Headers $apiWriteHeaders -ContentType 'application/json' -Body $apiBody
```

For the transport/authentication design, see the [OWASP REST security guidance](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) and [Node HTTPS documentation](https://nodejs.org/docs/latest-v24.x/api/https.html).
