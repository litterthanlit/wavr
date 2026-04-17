# Spec 0003 — Editor URL-state wiring

> **Status:** Draft
> **Blocks:** Step 1 completion in HANDOFF.md
> **Depends on:** `@wavr/schema` (encodeUrl/decodeUrl/tryDecodeUrl/migrate).

---

## 1. What this delivers

HANDOFF.md Step 1 requires: *"URL-encoded state wired into pushState on every change (debounced 200ms). Every config is a shareable link. Back/forward navigate config history."*

Concrete UX promise:
- Any change in the editor → URL hash reflects the new gradient within 200ms.
- Copy URL, paste anywhere → same gradient at any other tab.
- Browser back/forward → navigates edit history config by config.
- Open an old `#s=<base64>` URL → loads (via migrate), silently upgrades to `s2.` on the next edit.

This PR **retires** `apps/editor/lib/url.ts` as the codec and makes `@wavr/schema` the source of truth.

---

## 2. Architecture

```
┌─────────────────┐     subscribe     ┌──────────────────┐
│  Zustand store  │ ─────────────────▶│  URL sync layer  │
│  (GradientState)│                   │ (debounced 200ms)│
└─────────────────┘                   └────────┬─────────┘
         ▲                                     │
         │ loadPreset / setDiscrete            │ history.replaceState
         │                                     │ history.pushState
  ┌──────┴──────────┐                          ▼
  │ URL read on mount│◀──────popstate─── window.location.hash
  │  + popstate      │
  └─────────────────┘
```

Two boundaries:
- **Store → URL:** write path. A Zustand subscriber encodes the relevant slice, decides push vs replace, updates `window.location.hash`.
- **URL → Store:** read path. On mount and on `popstate`, decode the hash via `@wavr/schema` and apply.

A single module module `apps/editor/lib/url-sync.ts` owns both. The existing `apps/editor/lib/url.ts` becomes a thin shim (or gets deleted — see §7).

---

## 3. Store → URL

### 3.1 Only schema-owned fields go in the URL

Per spec 0001 §3.4 the store has three buckets. Only bucket A (schema-owned) is serialized:

- All fields that map to `GradientConfig` globals and effect groups.
- All fields on `state.layers` that map to `LayerConfig` (type, colors, speed, complexity, scale, distortion, opacity, blendMode, depth).

**Excluded from URL** (bucket B + C — see §3.4 of spec 0001):
- `activeLayerIndex`, `colorBlend`, `customGLSL`, the whole timeline block, the whole audio block, layer-extension fields (`visible`, `imageData`, masks, text-mask).

Write path:
1. Build `GradientConfig` from the store (adapter function `storeToConfig(state): GradientConfig`).
2. `GradientConfig.safeParse(config)` — if invalid, log and skip (never throw from the subscriber).
3. `encodeUrl(config)` → `s2....` string.
4. If encoded length > `MAX_URL_BYTES` (6KB), skip + log a one-time warning with "save as preset instead" guidance.
5. `history.replaceState` or `history.pushState` per §3.3.

### 3.2 Debounce semantics

200ms trailing-edge debounce. Rapid slider changes → one URL write per burst. Use `setTimeout` with a cancel-on-next-change pattern, *not* rAF-based throttling — we want wall-clock debouncing that survives tab-backgrounding.

### 3.3 push vs replace

The store distinguishes continuous updates (`set`) from atomic ones (`setDiscrete`). Mirror that in history:
- `set(...)` continuous drag → `replaceState` (don't pollute back-history with 1000 intermediate states).
- `setDiscrete(...)` toggle / preset / select → `pushState` (creates a back-history entry).
- `commitSet()` drag end → `pushState` with the final value (one history entry per drag).

**Implementation: explicit push-point signals.** Zustand's subscriber doesn't know which action fired, so we can't classify from the diff alone. The url-sync module exports a `markPushPoint()` function; `setDiscrete` and `commitSet` in `apps/editor/lib/store.ts` call it before running their mutation. The url-sync subscriber checks and consumes a "push-next-write" flag set by `markPushPoint()` — if set, next debounced write uses `pushState`; else `replaceState`.

**Cross-coupling:** this introduces a direct import from `store.ts` to `url-sync.ts`. Accepted — the alternatives (custom middleware, event bus, state-diff classification) are heavier. Document the coupling in both file headers.

### 3.4 Flush on unload

If the user closes the tab mid-debounce, the pending edit is lost from the URL. Add a `beforeunload` listener that synchronously flushes any pending debounced write via `history.replaceState`. Fires inside the 200ms window at most.

### 3.4 Ignore-URL-updates flag

When the URL changes because the user hit back/forward (or on first mount), the store gets updated via `loadPreset`. That mutation would otherwise re-trigger the subscriber and write to URL. Guard with a module-scope flag `applyingFromUrl: boolean` set inside the read path.

---

## 4. URL → Store

### 4.1 On mount

1. Read `window.location.hash`.
2. Call `tryDecodeUrl(hash)` from `@wavr/schema/url`.
3. On `ok: true`:
   - Set `applyingFromUrl = true`.
   - Apply the decoded `GradientConfig` to the store via a new adapter `configToStorePatch(config)`, then call `loadPreset(patch)`.
   - If `droppedKeys` is non-empty (i.e. we migrated from V1), `console.info("[wavr] v1 URL migrated, dropped editor-only fields:", droppedKeys)`. Stash `droppedKeys` under `window.__wavrDroppedKeys` as a side channel for later `EditorState` plumbing (spec 0002 / future work).
   - Re-write the URL via `history.replaceState("#" + encodeUrl(decoded))` so V1 `#s=...` immediately becomes `s2.` — no rewrite loop, see §3.4 guard.
   - Unset `applyingFromUrl`.
4. On `ok: false`: leave store at default, no error surfaced to the user (silent). One `console.info` in dev is fine.

### 4.2 On popstate

Identical path — re-read hash, decode, apply under `applyingFromUrl` guard. No V1 upgrade needed on popstate: the browser's back/forward only navigates history entries WE pushed, and we always push `s2.` format. The only way to encounter a V1 hash is via the very first mount (external link or bookmark); `popstate` never surfaces one.

### 4.3 storeToConfig / configToStorePatch adapters

These two functions are the only places that know about the store/schema shape mismatch. Live in `apps/editor/lib/url-sync.ts` next to the subscriber:

- `storeToConfig(state: GradientState): GradientConfig` — read the schema-owned fields, unflatten `noiseEnabled/noiseIntensity/noiseScale` style triples into the nested groups, rename `radialBlurAmount → radialBlur`, convert `threeDShape` number → `Shape3DKind` string, map `state.layers: LayerParams[]` → `LayerConfig[]` by picking the 9 schema-owned layer fields. This is the inverse of `migrate(project-state-v1)` in `@wavr/schema/migrate`.
- `configToStorePatch(config: GradientConfig): Partial<GradientState>` — the inverse. Flatten nested groups back into flat fields. Convert `Shape3DKind` string → number. Keep a passthrough for existing store fields that aren't in the config (timeline, audio, activeLayerIndex) — the loadPreset consumer handles partial patches.

**Don't silently import migrate's internals** — those functions handle `unknown` inputs and produce dropped-keys metadata. The store adapters are simpler (both sides typed) and belong in the editor, not in `@wavr/schema`.

---

## 5. Share-URL button compatibility

`apps/editor/components/TopBar.tsx` and `ExportModal.tsx` call `copyShareUrl(state)` today. That path:

1. Keep the export signature `copyShareUrl(state): Promise<void>`.
2. Internals swap to `getShareUrlV2(state)` which calls `storeToConfig` + `encodeUrl` + joins with the current page URL.
3. `window.history.replaceState` is redundant once the subscriber runs — but call it here anyway so "copy URL" always reflects the exact shown state even if the subscriber is mid-debounce.

The existing `apps/editor/lib/url.ts` public API stays callable but delegates to the new module. Deleting it fully is Spec 0004-ish cleanup — not in scope here.

---

## 6. Failure modes

| Scenario | Behavior |
|---|---|
| Store → GradientConfig parse fails | Log once to console (dev-only guard to avoid spam), skip URL write. |
| Encoded payload > 6KB | Log warning with guidance; skip URL write; leave previous hash in place. |
| Hash is `s2....` but LZ decode fails | Silent; leave store at default on mount, ignore on popstate. |
| Hash is V1 base64 but JSON invalid | Same as above — silent. |
| popstate fires with empty hash | Reset store to `DEFAULT_CONFIG` via `configToStorePatch(DEFAULT_CONFIG)`. |
| User manually edits the hash to garbage | Ignored (falls into "LZ decode fails" path). |

No error UI, no toasts. URL-state is a convenience surface; when it breaks we degrade to local-only editing without interrupting.

---

## 7. What `apps/editor/lib/url.ts` becomes

Current file has five exports: `encodeState`, `decodeState`, `getShareUrl`, `copyShareUrl`, plus the `ProjectState` type via imports.

Proposed transform:
- `encodeState` / `decodeState` → **deleted**. Nothing outside url.ts imports them (verified via `grep -r encodeState apps/editor`).
- `getShareUrl(state)` / `copyShareUrl(state)` → **re-implemented on top of `url-sync.ts::getShareUrlV2`**. Keep the names so TopBar/ExportModal don't change.

Clean result: `url.ts` becomes ~15 lines wrapping `url-sync.ts`. Two callers unchanged.

---

## 8. Acceptance criteria

- [ ] Open the editor, adjust the brightness slider from 1.0 → 1.5; within 300ms `window.location.hash` starts with `#s2.`.
- [ ] Copy that URL, open in a fresh incognito tab → same brightness and same gradient.
- [ ] Change layer type three times via the gradient-type dropdown (three discrete actions), hit browser back twice → each back step restores the previous layer type.
- [ ] Drag the brightness slider continuously for 2 seconds; `window.history.length` increases by at most 1 (one `pushState` at drag end, not one per rAF).
- [ ] Load a pre-Step-0 V1 URL (`#s=<base64>`) from the old format; gradient loads correctly, hash rewrites to `#s2....` on next edit, `console.info` logs the dropped keys.
- [ ] Manually edit the hash to `#s2.malformed`, reload; editor boots at default config, no UI error, single dev console.info.
- [ ] Unit test: mock `encodeUrl` to return a 7KB string (or inject a config synthesizer that breaches 6KB); the subscriber logs one `console.warn` mentioning "save as preset" and leaves `window.location.hash` unchanged. (Real-world `GradientConfig` can't easily breach 6KB — it carries no image data or custom GLSL — so this is a guard-rails check, not a UX path.)
- [ ] TopBar "copy URL" button still works; output is a `#s2....` URL.
- [ ] `pnpm --filter editor lint` passes. No new TS errors anywhere.

---

## 9. Out of scope

- Editor-state envelope for timeline / audio / `activeLayerIndex` — that's the future `EditorState` spec (slated by 0001 §3.4 C).
- Making the URL-sync test-covered end-to-end in Playwright. Unit tests for `storeToConfig` + `configToStorePatch` round-trip are in scope (`apps/editor/lib/url-sync.test.ts`).
- Polishing the V1 console.info into a user-visible toast. One line in the dev console is the right level of signal.
- Changing the hash format. Still `#s2....` (V2) or `#s=...` (V1) — no breaking change.

---

## 10. Implementation order

1. Create `apps/editor/lib/url-sync.ts` with `storeToConfig` + `configToStorePatch` + no-op subscriber/read plumbing.
2. Unit tests `apps/editor/lib/url-sync.test.ts` — round-trip a few representative store states (pure, no DOM).
3. Wire the subscriber (write path) with 200ms debounce, `applyingFromUrl` guard, push vs replace rule.
4. Wire the read path in `apps/editor/app/editor/page.tsx` — replace the existing `decodeState` mount handler with the new module's `applyHashToStore()`.
5. Add a `popstate` listener (same module).
6. Retrofit `copyShareUrl` to use the new encoder.
7. Delete `encodeState` / `decodeState` from url.ts, keep the public export shim.
8. Lint + manual acceptance run (launch dev, walk the 8 checks).

---

## 11. Open questions

- **Should `applyingFromUrl` also suppress the undo/redo history entry?** Probably yes — a URL-initiated load shouldn't be undoable (the user's back button IS the undo for that). Implementation: `loadPreset` already pushes an undo snapshot; wrap the URL-initiated `loadPreset` call in a suppressed path, or skip pushing. Low-priority polish; flag if not shipped in the PR.
- **Hash prefix: `#s2....` naked or `#s=s2....`?** Naked is shorter, cleaner, and matches what `encodeUrl` returns. The V1 legacy `#s=...` still decodes. Go naked — TopBar's copy needs to stitch the `#` and the encoded string without the `s=` affix.
