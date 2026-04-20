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
  HooksNode,
  HooksTree,
} from 'react-debug-tools/src/ReactDebugHooks';

export type {Fiber, FiberRoot};
export type {
  ChangeDescription,
  CommittedFiberChange,
  DetectedHookChange,
  ResolvedHookChange,
} from './collectFiberChanges';

import {inspectHooksOfFiber} from 'react-debug-tools';
import type {
  CommittedFiberChange,
  ResolvedHookChange,
} from './collectFiberChanges';
import collectFiberChanges from './collectFiberChanges';
import getHookName from './util/getHookName';

let isRecording: boolean = false;
type CommitRecord = {
  changes: Array<CommittedFiberChange>,
  currentDispatcherRef?: mixed,
};

let changes: Array<CommitRecord> = [];

type ResolvedHookEntry = {
  hook: HooksNode,
  path: Array<string>,
};

type HooksByMemoizedStateIndex = Map<number, ResolvedHookEntry>;

type HookResolutionCacheEntry = {
  currentDispatcherRef?: mixed,
  hooksByMemoizedStateIndex: HooksByMemoizedStateIndex | null,
};

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

function collectHooksByMemoizedStateIndex(
  tree: HooksTree,
  path: Array<string>,
  hooksByMemoizedStateIndex: HooksByMemoizedStateIndex,
  memoizedStateIndex: number,
): number {
  // eslint-disable-next-line no-for-of-loops/no-for-of-loops
  for (const hook of tree) {
    if (hook.subHooks.length > 0) {
      const hookName = getHookName(hook);
      memoizedStateIndex = collectHooksByMemoizedStateIndex(
        hook.subHooks,
        [...path, hookName],
        hooksByMemoizedStateIndex,
        memoizedStateIndex,
      );
      continue;
    }

    const consumption = getMemoizedStateConsumption(hook);
    // Hooks like useContext do not allocate a node in fiber.memoizedState,
    // so they consume 0 memoizedState slots and should not be indexed here.
    if (consumption === 0) {
      continue;
    }

    hooksByMemoizedStateIndex.set(memoizedStateIndex, {hook, path});
    memoizedStateIndex += consumption;
  }

  return memoizedStateIndex;
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

function getHooksByMemoizedStateIndex(
  cache: Map<Fiber, HookResolutionCacheEntry>,
  fiber: Fiber,
  currentDispatcherRef?: mixed,
): HooksByMemoizedStateIndex | null {
  const cached = cache.get(fiber);
  if (
    cached !== undefined &&
    cached.currentDispatcherRef === currentDispatcherRef
  ) {
    return cached.hooksByMemoizedStateIndex;
  }

  let hooksTree: HooksTree | null = null;
  try {
    hooksTree = inspectHooksOfFiber(fiber, currentDispatcherRef);
  } catch (error) {
    console.error('failed to inpect hook tree', error);
    hooksTree = null;
  }

  let hooksByMemoizedStateIndex: HooksByMemoizedStateIndex | null;
  if (hooksTree === null) {
    hooksByMemoizedStateIndex = null;
  } else {
    hooksByMemoizedStateIndex = new Map();
    collectHooksByMemoizedStateIndex(
      hooksTree,
      [],
      hooksByMemoizedStateIndex,
      0,
    );
  }

  cache.set(fiber, {
    currentDispatcherRef,
    hooksByMemoizedStateIndex,
  });
  return hooksByMemoizedStateIndex;
}

function flushCommit(): Array<Array<CommittedFiberChange>> {
  const flushed: Array<Array<CommittedFiberChange>> = [];
  const hookResolutionCache: Map<Fiber, HookResolutionCacheEntry> = new Map();

  // eslint-disable-next-line no-for-of-loops/no-for-of-loops
  for (const commitRecord of changes) {
    const {changes: commitChanges, currentDispatcherRef} = commitRecord;
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

      const hooksByMemoizedStateIndex = getHooksByMemoizedStateIndex(
        hookResolutionCache,
        change.fiber,
        currentDispatcherRef,
      );

      if (hooksByMemoizedStateIndex === null) {
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
        const resolvedHook = hooksByMemoizedStateIndex.get(
          hookIndex.hookIndex,
        );
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

        resolvedHooks.push({
          hookIndex: resolvedHook.hook.id,
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

export function onCommitFiber(
  root: FiberRoot,
  currentDispatcherRef?: mixed,
): Array<CommittedFiberChange> {
  if (!isRecording) {
    return [];
  }
  if (root.current == null || root.current.child == null) {
    return [];
  }

  const commitChanges: Array<CommittedFiberChange> = [];
  collectFiberChanges(root.current, commitChanges);
  changes.push({
    changes: commitChanges,
    currentDispatcherRef,
  });

  return commitChanges;
}
