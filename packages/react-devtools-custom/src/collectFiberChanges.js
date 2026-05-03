/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Fiber} from 'react-reconciler/src/ReactInternalTypes';
import type {HookSource} from 'react-debug-tools/src/ReactDebugHooks';

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
import didStatefulHookChange from './didStatefulHookChange';
import getComponentNameFromType from 'shared/getComponentNameFromType';

const IndeterminateComponent = 2;

export type DetectedHookChange = {
  hookIndex: number,
  prev: mixed,
  next: mixed,
};

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
  hooks?: Array<DetectedHookChange | ResolvedHookChange> | null,
  isFirstMount: boolean,
  props: Array<string> | null,
  state: Array<string> | null,
};

export type CommittedFiberChange = {
  // Inclusive render duration for this Fiber in milliseconds, if profiling
  // timings are available for the current React build.
  actualDuration: number | null,
  displayName: string | null,
  fiber: Fiber,
  prevFiber: Fiber | null,
  // Render duration excluding direct child Fibers in milliseconds.
  selfDuration: number,
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

function getActualDuration(fiber: Fiber): number | null {
  return fiber.actualDuration != null ? fiber.actualDuration : null;
}

function getSelfDuration(fiber: Fiber): number {
  const actualDuration = getActualDuration(fiber);
  if (actualDuration === null) {
    return 0;
  }

  let selfDuration = actualDuration;
  let child = fiber.child;
  while (child !== null) {
    selfDuration -= child.actualDuration || 0;
    child = child.sibling;
  }

  return selfDuration;
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

// packages/react-devtools-shared/src/backend/fiber/renderer.js [1327]
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

export default function collectFiberChanges(
  fiber: Fiber | null,
  changes: Array<CommittedFiberChange>,
  mountedFibers: WeakSet<Fiber>,
): void {
  if (fiber === null) {
    return;
  }

  const prevFiber = fiber.alternate;
  if (prevFiber === null) {
    // alternate === null can mean either "newly mounted this commit" or "was
    // mounted before recording started and never WIP'd since (deep bailout
    // reuses the original fiber via cloneChildFibers no-op)". mountedFibers
    // captures the latter case at startRecording time.
    if (!mountedFibers.has(fiber)) {
      const changeDescription = getChangeDescription(prevFiber, fiber);
      if (changeDescription !== null) {
        changes.push({
          ...changeDescription,
          actualDuration: getActualDuration(fiber),
          displayName: getDisplayNameForFiber(fiber),
          fiber,
          prevFiber,
          selfDuration: getSelfDuration(fiber),
        });
      }
      mountedFibers.add(fiber);
    }
  } else if (didFiberRender(ReactTypeOfWork, prevFiber, fiber)) {
    const changeDescription = getChangeDescription(prevFiber, fiber);
    if (changeDescription !== null) {
      changes.push({
        ...changeDescription,
        actualDuration: getActualDuration(fiber),
        displayName: getDisplayNameForFiber(fiber),
        fiber,
        prevFiber,
        selfDuration: getSelfDuration(fiber),
      });
    }
  }

  const subtreeFullyBailedOut =
    fiber.child !== null &&
    prevFiber !== null &&
    fiber.child === prevFiber.child;
  if (!subtreeFullyBailedOut) {
    collectFiberChanges(fiber.child, changes, mountedFibers);
  }
  collectFiberChanges(fiber.sibling, changes, mountedFibers);
}
