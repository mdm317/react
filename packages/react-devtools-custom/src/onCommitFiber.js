/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Fiber, FiberRoot} from 'react-reconciler/src/ReactInternalTypes';
import type {HookSource} from 'react-debug-tools/src/ReactDebugHooks';

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
import getComponentNameFromType from 'shared/getComponentNameFromType';
import hasOwnProperty from 'shared/hasOwnProperty';

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
  fiberType?: Fiber.type,
  hooks?: Array<RecordedHookChange> | null,
  isFirstMount: boolean,
  props: Array<string> | null,
  state: Array<string> | null,
};

export type CommittedFiberChange = {
  changeDescription: ChangeDescription,
  displayName: string | null,
  fiber: Fiber,
  prevFiber: Fiber | null,
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
          fiberType: nextFiber.tag,
          isFirstMount: true,
          props: null,
          state: null,
        };
      }

      return {
        context: getContextChanged(prevFiber, nextFiber),
        didHooksChange: false,
        fiberType: nextFiber.tag,
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
        fiberType: indices ? nextFiber.type : null,
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
        changeDescription,
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
let changes: Array<CommittedFiberChange> = [];

export function startRecording(): void {
  isRecording = true;
  changes = [];
}

export function endRecording(): Array<CommittedFiberChange> {
  isRecording = false;
  const recorded = changes;
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
