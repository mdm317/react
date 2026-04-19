/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Fiber, FiberRoot} from 'react-reconciler/src/ReactInternalTypes';
import type {
  HookSource,
  HooksNode,
  HooksTree,
} from 'react-debug-tools/src/ReactDebugHooks';

export type {Fiber, FiberRoot};

import {
  ClassComponent,
  ContextConsumer,
  ForwardRef,
  FunctionComponent,
  IncompleteFunctionComponent,
  MemoComponent,
  SimpleMemoComponent,
} from 'react-reconciler/src/ReactWorkTags';
import {
  didFiberRender,
  getChangedKeys,
  getContextChanged,
} from 'react-devtools-shared/src/backend/fiber/shared/DevToolsFiberChangeDetection';
import {inspectHooksOfFiber} from 'react-debug-tools';
import getComponentNameFromType from 'shared/getComponentNameFromType';

const IndeterminateComponent = 2;

// Low-level hook change detected by diffing the prev/next fiber's memoizedState
// linked list. `hookIndex` is the raw position in that list; no hook-tree
// metadata (name/path/source) has been resolved yet. Produced by
// getChangedHooksIndices during commit.
export type DetectedHookChange = {
  hookIndex: number,
  prev: mixed,
  next: mixed,
};

// Hook change after matching a DetectedHookChange against the hook tree from
// inspectHooksOfFiber. `hookIndex` is remapped to the resolved hook-tree index
// (`hook.id`) for the matching slot-consuming hook, and
// hookName/hookPath/hookSource carry the resolved metadata. Produced by
// flushCommit at endRecording time.
export type ResolvedHookChange = {
  hookIndex: number,
  hookName?: string | null,
  hookPath?: Array<string> | null,
  hookSource?: HookSource | null,
  prev: mixed,
  next: mixed,
};

export type ChangeDescription = {
  context: Array<string> | boolean | null,
  didHooksChange: boolean,
  // DetectedHookChange while recording; ResolvedHookChange after flushCommit.
  hooks?: Array<DetectedHookChange | ResolvedHookChange> | null,
  isFirstMount: boolean,
  props: Array<string> | null,
  state: Array<string> | null,
};

export type CommittedFiberChange = {
  displayName: string | null,
  fiber: Fiber,
  prevFiber: Fiber | null,
  ...ChangeDescription,
};

const ReactTypeOfWork = {
  ClassComponent,
  ContextConsumer,
  ForwardRef,
  FunctionComponent,
  MemoComponent,
  SimpleMemoComponent,
};

function getDisplayNameForFiber(fiber: Fiber): string | null {
  return getComponentNameFromType(fiber.type);
}

function didStatefulHookChange(prev: any, next: any): boolean {
  return prev.memoizedState !== next.memoizedState;
}

function getChangedHooksIndices(
  prev: any,
  next: any,
): Array<DetectedHookChange> | null {
  if (prev == null || next == null) {
    return null;
  }

  const detected: Array<DetectedHookChange> = [];
  let index = 0;

  while (next !== null) {
    if (didStatefulHookChange(prev, next)) {
      detected.push({
        hookIndex: index,
        prev: prev.memoizedState,
        next: next.memoizedState,
      });
    }

    next = next.next;
    prev = prev.next;
    index++;
  }

  return detected;
}

function getChangeDescription(
  prevFiber: Fiber | null,
  nextFiber: Fiber,
): ChangeDescription | null {
  switch (nextFiber.tag) {
    case ClassComponent:
      if (prevFiber === null) {
        return {
          context: null,
          didHooksChange: false,
          isFirstMount: true,
          props: null,
          state: null,
        };
      }

      return {
        context: getContextChanged(prevFiber, nextFiber),
        didHooksChange: false,
        isFirstMount: false,
        props: getChangedKeys(prevFiber.memoizedProps, nextFiber.memoizedProps),
        state: getChangedKeys(prevFiber.memoizedState, nextFiber.memoizedState),
      };
    case IncompleteFunctionComponent:
    case FunctionComponent:
    case IndeterminateComponent:
    case ForwardRef:
    case MemoComponent:
    case SimpleMemoComponent:
      if (prevFiber === null) {
        return {
          context: null,
          didHooksChange: false,
          isFirstMount: true,
          props: null,
          state: null,
        };
      }

      const detectedHooks = getChangedHooksIndices(
        prevFiber.memoizedState,
        nextFiber.memoizedState,
      );

      return {
        context: getContextChanged(prevFiber, nextFiber),
        didHooksChange: detectedHooks !== null && detectedHooks.length > 0,
        hooks: detectedHooks,
        isFirstMount: false,
        props: getChangedKeys(prevFiber.memoizedProps, nextFiber.memoizedProps),
        state: null,
      };
    default:
      return null;
  }
}

function collectFiberChanges(
  fiber: Fiber | null,
  changes: Array<CommittedFiberChange>,
): void {
  if (fiber === null) {
    return;
  }

  const prevFiber = fiber.alternate;
  if (prevFiber === null || didFiberRender(ReactTypeOfWork, prevFiber, fiber)) {
    const changeDescription = getChangeDescription(prevFiber, fiber);
    if (changeDescription !== null) {
      changes.push({
        ...changeDescription,
        displayName: getDisplayNameForFiber(fiber),
        fiber,
        prevFiber,
      });
    }
  }

  collectFiberChanges(fiber.child, changes);
  collectFiberChanges(fiber.sibling, changes);
}

let isRecording: boolean = false;
let changes: Array<Array<CommittedFiberChange>> = [];

type HookLookupEntry = {
  hook: HooksNode,
  path: Array<string>,
};

type HooksByFiberMemoizedStateIndex = Map<number, HookLookupEntry>;

function getMemoizedStateConsumption(hook: HooksNode): number {
  // Native hooks with id === null do not call nextHook() and so consume 0 slots.
  // Some composite hooks call nextHook() multiple times internally.
  if (hook.id === null) {
    return 0;
  }
  switch (hook.name) {
    case 'SyncExternalStore':
    case 'Transition':
      return 2;
    case 'ActionState':
    case 'FormState':
      return 3;
    default:
      return 1;
  }
}

function collectHooksByFiberMemoizedStateIndex(
  tree: HooksTree,
  path: Array<string>,
  hooksByFiberMemoizedStateIndex: HooksByFiberMemoizedStateIndex,
  memCounter: number,
): number {
  // eslint-disable-next-line no-for-of-loops/no-for-of-loops
  for (const hook of tree) {
    if (hook.subHooks.length > 0) {
      memCounter = collectHooksByFiberMemoizedStateIndex(
        hook.subHooks,
        [...path, hook.name],
        hooksByFiberMemoizedStateIndex,
        memCounter,
      );
      continue;
    }

    const consumption = getMemoizedStateConsumption(hook);
    // Hooks like useContext do not allocate a node in fiber.memoizedState,
    // so they consume 0 memoizedState slots and should not be indexed here.
    if (consumption === 0) {
      continue;
    }

    const fiberMemoizedStateIndex = memCounter;
    hooksByFiberMemoizedStateIndex.set(fiberMemoizedStateIndex, {hook, path});
    memCounter = fiberMemoizedStateIndex + consumption;
  }

  return memCounter;
}

function isStatefulHookNode(hook: HooksNode): boolean {
  return (
    hook.isStateEditable === true ||
    hook.name === 'SyncExternalStore' ||
    hook.name === 'Transition' ||
    hook.name === 'ActionState' ||
    hook.name === 'FormState'
  );
}

function getHooksByFiberMemoizedStateIndex(
  cache: Map<Fiber, HooksByFiberMemoizedStateIndex | null>,
  fiber: Fiber,
): HooksByFiberMemoizedStateIndex | null {
  const cached = cache.get(fiber);
  if (cached !== undefined) {
    return cached;
  }

  let hooksTree: HooksTree | null = null;
  try {
    hooksTree = inspectHooksOfFiber(fiber);
  } catch (error) {
    hooksTree = null;
  }

  let hooksByFiberMemoizedStateIndex: HooksByFiberMemoizedStateIndex | null;
  if (hooksTree === null) {
    hooksByFiberMemoizedStateIndex = null;
  } else {
    hooksByFiberMemoizedStateIndex = new Map();
    collectHooksByFiberMemoizedStateIndex(
      hooksTree,
      [],
      hooksByFiberMemoizedStateIndex,
      0,
    );
  }

  cache.set(fiber, hooksByFiberMemoizedStateIndex);
  return hooksByFiberMemoizedStateIndex;
}

function flushCommit(): Array<Array<CommittedFiberChange>> {
  const flushed: Array<Array<CommittedFiberChange>> = [];
  const hooksByFiberMemoizedStateIndexByFiber: Map<
    Fiber,
    HooksByFiberMemoizedStateIndex | null,
  > = new Map();
  // eslint-disable-next-line no-for-of-loops/no-for-of-loops
  for (const commitChanges of changes) {
    const nextCommitChanges: Array<CommittedFiberChange> = [];
    // eslint-disable-next-line no-for-of-loops/no-for-of-loops
    for (const change of commitChanges) {
      // `change.hooks` at flush time is always an array of DetectedHookChange
      // (populated by getChangedHooksIndices during commit). We resolve each
      // one into a ResolvedHookChange below.
      const hookIndices = change.hooks;
      if (hookIndices == null || hookIndices.length === 0) {
        nextCommitChanges.push(change);
        continue;
      }

      const hooksByFiberMemoizedStateIndex =
        getHooksByFiberMemoizedStateIndex(
          hooksByFiberMemoizedStateIndexByFiber,
          change.fiber,
        );

      if (hooksByFiberMemoizedStateIndex === null) {
        nextCommitChanges.push(change);
        console.error(
          'react-devtools-custom: failed to build hook index for fiber %o',
          change.fiber,
        );
        continue;
      }

      const resolvedHooks: Array<ResolvedHookChange> = [];
      // eslint-disable-next-line no-for-of-loops/no-for-of-loops
      for (const hookIndex of hookIndices) {
        const resolvedHook =
          hooksByFiberMemoizedStateIndex.get(hookIndex.hookIndex);
        if (resolvedHook === undefined) {
          console.error(
            'react-devtools-custom: no hook found at fiber memoizedState index %s for fiber %o',
            hookIndex.hookIndex,
            change.fiber,
          );
          continue;
        }
        if (!isStatefulHookNode(resolvedHook.hook)) {
          continue;
        }
        const resolvedHookIndex = resolvedHook.hook.id;
        if (resolvedHookIndex === null) {
          continue;
        }
        resolvedHooks.push({
          hookIndex: resolvedHookIndex,
          hookName: resolvedHook.hook.name,
          hookPath: [...resolvedHook.path, resolvedHook.hook.name],
          hookSource: resolvedHook.hook.hookSource,
          prev: hookIndex.prev,
          next: hookIndex.next,
        });
      }

      nextCommitChanges.push({
        ...change,
        didHooksChange: resolvedHooks.length > 0,
        hooks: resolvedHooks,
      });
    }
    flushed.push(nextCommitChanges);
  }
  return flushed;
}

export function startRecording(): void {
  isRecording = true;
  changes = [];
}

export function endRecording(): Array<Array<CommittedFiberChange>> {
  isRecording = false;
  const recorded = flushCommit();
  changes = [];
  return recorded;
}

export function onCommitFiber(root: FiberRoot): Array<CommittedFiberChange> {
  if (!isRecording) {
    return [];
  }
  if (root.current == null || root.current.child == null) {
    return [];
  }

  const commitChanges: Array<CommittedFiberChange> = [];
  collectFiberChanges(root.current, commitChanges);
  changes.push(commitChanges);

  return commitChanges;
}
