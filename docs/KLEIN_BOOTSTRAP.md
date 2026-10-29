# Klein first-run bootstrapping - 2026-10-28

A fresh installation can initiate its first real Klein generation through an explicit selection once its prerequisites pass. No pre-existing runtime-success file is required.

| Readiness | available | firstRunAvailable | tested | Behavior |
|---|---|---|---|---|
| not-ready | false | false | false, or historical true if currently resource-blocked | Missing/corrupt files, incompatible workflow/nodes, offline/unknown queue, busy or insufficient memory blocks both paths. |
| unverified | false | true | false | Select Klein explicitly; the engine chooser labels first-run verification. Use the normal fact/direction-reviewed Generate action. Automatic skips this state. |
| verified | true | false | true | Existing successful render proof matches this graph, pinned files, ComfyUI version and GPU. Normal and Automatic use remain subject to admission. |

Scene, background and hybrid extraction/background modes share the integrity/readiness calculation. Their existing SDK/proxy routes accept either verified availability or explicit first-run eligibility, both before claiming the reviewed receipt and again inside the serialized queue. Missing or corrupt files never become eligible. Workflow hashes and weight SHA-256 checks remain enforced; changed runtime identity requires a new explicit verification.

No success file is manufactured during capability checks. The existing renderer writes provenance and the runtime-success record only after a successful job and its PNG/executed-graph checks (including source-byte verification for reference editing). Failure/cancellation or invalid delivery leaves a fresh runtime unverified and retains the existing failure records. A retry is a deliberate fresh reviewed attempt; exclusive receipts and cancellation behavior remain intact.

## Bounded validation

`npm run test:klein-bootstrap` passes: 5 files / 13 reported checks, including 9 fresh-install regression cases. Tests copy the real runtime/graphs into an isolated ignored fixture directory, substituting tiny test-only weight contracts and a mocked SDK. They exercise actual hashing, readiness, provenance writers and HTTP admission without creating production verification records or doing GPU inference. Coverage includes three no-proof modes; missing/same-size-corrupt weights; offline/queue/memory/node blocks; altered workflow hash; successful evidence; failed-run recovery; rejected output metadata; changed runtime identity; and the reviewed HTTP path reaching the SDK while local-access denial stays enforced.

Typecheck and build pass with Node 22.20.0. Logs: `outputs/klein-bootstrap-fix/` (ignored).

## Live verification remains pending

The installed ComfyUI 0.42.4 / RTX 3080 was online with an empty queue. Final read-only preflight reported 1,857,761,280 bytes (about 1.73 GiB) free/reclaimable VRAM and 8,332,259,328 bytes free RAM. This fails the existing 3.5 GiB background floor and 6 GiB reference-scene floor. No GPU job was submitted, no other process was stopped, and no cache was freed to force admission.

A successful real first render and its native evidence are therefore still unverified in this fix session. The deterministic tests establish that the code path is reachable and that the existing evidence writers promote readiness correctly; they are not real model execution evidence. Once the configured local runtime satisfies its original admission checks, the explicit first-run path can be used with an authorized fixture.
