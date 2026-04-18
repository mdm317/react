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

export type ChangedHook = {
  hookIndex: number,
  hookName?: string | null,
  hookPath?: Array<string> | null,
  hookSource?: HookSource | null,
  prev: mixed,
  next: mixed,
};

export type RecordedHookChange = {
  hookIndex: number,
  isParsed: boolean,
  prev: mixed,
  next: mixed,
};

export type ChangeDescription = {
  context: Array<string> | boolean | null,
  didHooksChange: boolean,
  hooks?: Array<RecordedHookChange | ChangedHook> | null,
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

function isHookThatCanScheduleUpdate(hookObject: any): boolean {
  const queue = hookObject.queue;
  if (!queue) {
    return false;
  }

  const boundHasOwnProperty = hasOwnProperty.bind(queue);

  // Detect the shape of useState() / useReducer() / useTransition()
  // using the attributes that are unique to these hooks
  // but also stable (e.g. not tied to current Lanes implementation)
  // We don't check for dispatch property, because useTransition doesn't have it
  return boundHasOwnProperty('pending');
}

function didStatefulHookChange(prev: any, next: any): boolean {
  const prevMemoizedState = prev.memoizedState;
  const nextMemoizedState = next.memoizedState;

  if (isHookThatCanScheduleUpdate(prev)) {
    return prevMemoizedState !== nextMemoizedState;
  }

  return false;
}

function getChangedHooksIndices(
  prev: any,
  next: any,
): Array<RecordedHookChange> | null {
  if (prev == null || next == null) {
    return null;
  }

  const indices: Array<RecordedHookChange> = [];
  let index = 0;

  while (next !== null) {
    if (didStatefulHookChange(prev, next)) {
      indices.push({
        hookIndex: index,
        isParsed: false,
        prev: prev.memoizedState,
        next: next.memoizedState,
      });
    }

    next = next.next;
    prev = prev.next;
    index++;
  }

  return indices;
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

      const indices = getChangedHooksIndices(
        prevFiber.memoizedState,
        nextFiber.memoizedState,
      );

      return {
        context: getContextChanged(prevFiber, nextFiber),
        didHooksChange: indices !== null && indices.length > 0,
        hooks: indices,
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

function flattenHooksTree(
  tree: HooksTree,
  path: Array<string>,
  flat: Array<{hook: HooksNode, path: Array<string>}>,
): void {
  // eslint-disable-next-line no-for-of-loops/no-for-of-loops
  for (const hook of tree) {
    if (hook.subHooks.length > 0) {
      flattenHooksTree(hook.subHooks, [...path, hook.name], flat);
      continue;
    }
    flat.push({hook, path});
  }
}

function flushCommit(): Array<Array<CommittedFiberChange>> {
  const flushed: Array<Array<CommittedFiberChange>> = [];
  // eslint-disable-next-line no-for-of-loops/no-for-of-loops
  for (const commitChanges of changes) {
    const nextCommitChanges: Array<CommittedFiberChange> = [];
    // eslint-disable-next-line no-for-of-loops/no-for-of-loops
    for (const change of commitChanges) {
      const recordedHooks = change.hooks;
      if (recordedHooks == null || recordedHooks.length === 0) {
        nextCommitChanges.push(change);
        continue;
      }

      let hooksTree: HooksTree | null = null;
      try {
        hooksTree = inspectHooksOfFiber(change.fiber);
      } catch (error) {
        hooksTree = null;
      }
      if (hooksTree === null) {
        nextCommitChanges.push(change);
        continue;
      }

      const flatHooks: Array<{hook: HooksNode, path: Array<string>}> = [];
      flattenHooksTree(hooksTree, [], flatHooks);

      const changedHooks: Array<ChangedHook> = [];
      // eslint-disable-next-line no-for-of-loops/no-for-of-loops
      for (const recorded of recordedHooks) {
        const entry = flatHooks[recorded.hookIndex];
        if (entry == null) {
          changedHooks.push({
            hookIndex: recorded.hookIndex,
            prev: recorded.prev,
            next: recorded.next,
          });
          continue;
        }
        changedHooks.push({
          hookIndex: recorded.hookIndex,
          hookName: entry.hook.name,
          hookPath: [...entry.path, entry.hook.name],
          hookSource: entry.hook.hookSource,
          prev: recorded.prev,
          next: recorded.next,
        });
      }

      nextCommitChanges.push({...change, hooks: changedHooks});
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
