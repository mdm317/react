/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {
  Fiber as ReactFiber,
  FiberRoot as ReactFiberRoot,
} from 'react-reconciler/src/ReactInternalTypes';
import type {
  HookSource,
  HooksNode,
  HooksTree,
} from 'react-debug-tools/src/ReactDebugHooks';

import {inspectHooksOfFiber} from 'react-debug-tools';
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
  didStatefulHookChange,
  getChangedKeys,
  getContextChanged,
} from 'react-devtools-shared/src/backend/fiber/shared/DevToolsFiberChangeDetection';
import getComponentNameFromType from 'shared/getComponentNameFromType';

const IndeterminateComponent = 2;

export type Fiber = ReactFiber;

export type FiberRoot = ReactFiberRoot;

export type ChangedHook = {
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
  hooks?: Array<ChangedHook> | null,
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

function getHooksTree(
  fiber: Fiber,
  currentDispatcherRef?: mixed,
): HooksTree | null {
  try {
    return inspectHooksOfFiber(fiber, currentDispatcherRef);
  } catch {
    return null;
  }
}

function getChangedHooks(
  prevHooks: HooksTree | null,
  nextHooks: HooksTree | null,
): Array<ChangedHook> | null {
  if (prevHooks == null || nextHooks == null) {
    return null;
  }

  const changedHooks: Array<ChangedHook> = [];

  function traverse(
    prevTree: HooksTree,
    nextTree: HooksTree,
    customHookPath: Array<string>,
  ): void {
    const customHookCounts = new Map<string, number>();
    const length = Math.min(prevTree.length, nextTree.length);

    for (let index = 0; index < length; index++) {
      const prevHook: HooksNode = prevTree[index];
      const nextHook: HooksNode = nextTree[index];

      let nextCustomHookPath = customHookPath;
      if (nextHook.id === null && nextHook.subHooks.length > 0) {
        const customHookCount = customHookCounts.get(nextHook.name) ?? 0;
        customHookCounts.set(nextHook.name, customHookCount + 1);
        nextCustomHookPath = [
          ...customHookPath,
          `${nextHook.name}(${customHookCount})`,
        ];
      }

      if (prevHook.subHooks.length > 0 && nextHook.subHooks.length > 0) {
        traverse(prevHook.subHooks, nextHook.subHooks, nextCustomHookPath);
        continue;
      }

      if (didStatefulHookChange(prevHook, nextHook) && nextHook.id !== null) {
        changedHooks.push({
          hookIndex: nextHook.id,
          hookName: nextHook.name,
          hookPath: [...customHookPath, nextHook.name],
          hookSource: nextHook.hookSource,
          prev: prevHook.value,
          next: nextHook.value,
        });
      }
    }
  }

  traverse(prevHooks, nextHooks, []);
  return changedHooks;
}

function getChangeDescription(
  prevFiber: Fiber | null,
  nextFiber: Fiber,
  currentDispatcherRef?: mixed,
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

      const prevHooks = getHooksTree(prevFiber, currentDispatcherRef);
      const nextHooks = getHooksTree(nextFiber, currentDispatcherRef);
      const hooks = getChangedHooks(prevHooks, nextHooks);

      return {
        context: getContextChanged(prevFiber, nextFiber),
        didHooksChange: hooks !== null && hooks.length > 0,
        hooks,
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
  currentDispatcherRef?: mixed,
): void {
  if (fiber === null) {
    return;
  }

  const prevFiber = fiber.alternate;
  if (
    prevFiber === null ||
    didFiberRender(ReactTypeOfWork, prevFiber, fiber)
  ) {
    const changeDescription = getChangeDescription(
      prevFiber,
      fiber,
      currentDispatcherRef,
    );
    if (changeDescription !== null) {
      changes.push({
        changeDescription,
        displayName: getDisplayNameForFiber(fiber),
        fiber,
        prevFiber,
      });
    }
  }

  collectFiberChanges(fiber.child, changes, currentDispatcherRef);
  collectFiberChanges(fiber.sibling, changes, currentDispatcherRef);
}

export function onCommitFiber(
  root: FiberRoot,
  currentDispatcherRef?: mixed,
): Array<CommittedFiberChange> {
  if (root.current == null || root.current.child == null) {
    return [];
  }

  const changes: Array<CommittedFiberChange> = [];
  collectFiberChanges(root.current, changes, currentDispatcherRef);
  return changes;
}
