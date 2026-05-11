# `react-devtools-custom`

Custom React DevTools helpers for external commit change detection.

## Build

```bash
yarn workspace react-devtools-custom build
```

The built package will be emitted under `packages/react-devtools-custom/dist`.

## API Surface

The package exposes two independent surfaces:

1. **DevTools backend bootstrap** — `installHook`
2. **Commit-change recording** — `startRecording` / `onCommitFiber` / `endRecording`

Both are exported from the package root. Type declarations live in [`index.d.ts`](./index.d.ts); runtime entry is [`index.js`](./index.js); recording logic lives in [`src/onCommitFiber.js`](./src/onCommitFiber.js).

### `installHook(target, componentFilters, settings?, shouldStartProfilingNow?, profilingSettings?)`

Installs the standard `react-devtools-core` backend on the global object and returns the resulting `__REACT_DEVTOOLS_GLOBAL_HOOK__`.

- `target` — must be `globalThis` / `window`. Other targets throw.
- `componentFilters` — array (or Promise of array) passed straight through to `react-devtools-core/backend#initialize`.
- `settings` — optional `DevToolsHookSettings` (or Promise).
- `shouldStartProfilingNow` — optional flag forwarded to the backend.
- `profilingSettings` — optional `ProfilingSettings` (`recordChangeDescriptions`, `recordTimeline`).

Returns `DevToolsHook | null`.

### Recording API

A recording is an ordered list of commits. Each commit is the set of fibers that changed (rendered, mounted, or had context/hook changes) during one React commit phase.

#### `startRecording(roots)`

- `roots: FiberRoot | Array<FiberRoot>` — the root(s) to record.

Initializes internal state and snapshots the currently mounted fibers in each root so deep-bailout subtrees are not later mistaken for first mounts.

Must be called before `onCommitFiber` will collect anything.

#### `onCommitFiber(root, currentDispatcherRef?)`

- `root: FiberRoot` — the root that just committed.
- `currentDispatcherRef` — pass the renderer's `currentDispatcherRef` so hook trees can be inspected via `react-debug-tools` at flush time.

Called on every React commit (typically from the DevTools `onCommitFiberRoot` hook). Walks `root.current`, diffs each fiber against its alternate, and pushes a `CommitRecord` into the internal buffer.

Returns the `Array<CommittedFiberChange>` for **this commit only**. The same data is also kept internally and returned later by `endRecording()`.

If `isRecording` is false, returns `[]` and does nothing.

#### `endRecording()`

Stops recording, runs `flushCommit` (which resolves `DetectedHookChange` → `ResolvedHookChange` using `inspectHooksOfFiber`), clears the buffer, and returns every commit accumulated since `startRecording`.

Return type: `Array<Array<CommittedFiberChange>>`
- Outer array: one entry **per commit**, in commit order.
- Inner array: every fiber that changed within that commit (parent + children that re-rendered together live in the same inner array).

### Types

Re-exported from `./src/onCommitFiber` and declared in `index.d.ts`:

| Type | Purpose |
| --- | --- |
| `Fiber`, `FiberRoot` | Re-exports of `react-reconciler` internal types. |
| `ChangeDescription` | Per-fiber change summary: `props`, `state`, `context`, `hooks`, `didHooksChange`, `isFirstMount`. |
| `CommittedFiberChange` | `ChangeDescription` plus `fiber`, `prevFiber`, `displayName`, `actualDuration`, `selfDuration`. The element of the inner array. |
| `DetectedHookChange` | Raw hook diff produced during commit. `hookIndex` is the position in the fiber's `memoizedState` linked list; no hook-tree metadata yet. |
| `ResolvedHookChange` | Result of resolving a `DetectedHookChange` against the hook tree at `endRecording` time. `hookIndex` is remapped to the hook tree id; carries `hookName`, `hookPath`, `hookSource`. |

### Recording lifecycle

```
startRecording(roots)
  └── snapshot mounted fibers per root

onCommitFiber(root, dispatcherRef)        ← call from DevTools hook on every commit
  └── collectFiberChanges()
        ├── diff alternate vs. current
        ├── detect hook changes by index (DetectedHookChange)
        └── push { changes, currentDispatcherRef } onto buffer

endRecording()
  ├── flushCommit() → resolve DetectedHookChange → ResolvedHookChange
  ├── clear buffer + mounted-fiber snapshots
  └── return Array<Array<CommittedFiberChange>>  // one inner array per commit
```

Notes:
- A parent that renders and the children re-rendered as a result of that parent's render belong to the **same** inner array (single React commit).
- A subsequent commit triggered by, e.g., a `setState` in an effect produces a separate inner array.
- Hook resolution is deferred to `endRecording`; the `hooks` array on a `CommittedFiberChange` is `DetectedHookChange[]` while recording and `ResolvedHookChange[]` after flush.
- `selfDuration` and `actualDuration` come from the React profiler timings; if profiling timings are unavailable for the build, `selfDuration` is `0` and `actualDuration` is `null`.
