/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

export function installHook(
  target: any,
  componentFiltersOrComponentFiltersPromise: any,
  maybeSettingsOrSettingsPromise?: any,
  shouldStartProfilingNow?: boolean,
  profilingSettings?: any,
) {
  if (typeof target !== 'object' || target == null) {
    throw new Error('installHook(target) requires a global object target.');
  }

  if (target !== globalThis) {
    throw new Error(
      'react-devtools-custom installHook currently only supports globalThis/window as the target.',
    );
  }

  const backend = require('react-devtools-core/backend');
  backend.initialize(
    maybeSettingsOrSettingsPromise,
    shouldStartProfilingNow,
    profilingSettings,
    componentFiltersOrComponentFiltersPromise,
  );

  return target.__REACT_DEVTOOLS_GLOBAL_HOOK__ ?? null;
}

export {
  endRecording,
  onCommitFiber,
  startRecording,
} from './src/onCommitFiber';

export type {
  ChangedHook,
  ChangeDescription,
  CommittedFiberChange,
  Fiber,
  FiberRoot,
} from './src/onCommitFiber';
