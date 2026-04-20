/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

// Source: extracted from `packages/react-devtools-shared/src/backend/fiber/renderer.js`
// on `upstream/main` at `4a3d993e52`, right before `53daaf5aba` switched
// changed-hook detection to the `inspectHooks(prevFiber)` / `inspectHooks(nextFiber)` path.
// (#35123)

const hasOwnProperty = Object.prototype.hasOwnProperty;

function isUseSyncExternalStoreHook(hookObject: any): boolean {
  const queue = hookObject.queue;
  if (!queue) {
    return false;
  }

  const boundHasOwnProperty = hasOwnProperty.bind(queue);
  return (
    boundHasOwnProperty('value') &&
    boundHasOwnProperty('getSnapshot') &&
    typeof queue.getSnapshot === 'function'
  );
}

// Currently, this only supports useSyncExternalStore.
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
  if (boundHasOwnProperty('pending')) {
    return true;
  }

  return isUseSyncExternalStoreHook(hookObject);
}

export default function didStatefulHookChange(prev: any, next: any): boolean {
  const prevMemoizedState = prev.memoizedState;
  const nextMemoizedState = next.memoizedState;

  if (isHookThatCanScheduleUpdate(prev)) {
    return prevMemoizedState !== nextMemoizedState;
  }

  return false;
}
