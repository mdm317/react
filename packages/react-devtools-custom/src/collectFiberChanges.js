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
