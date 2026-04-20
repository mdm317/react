/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {HooksNode} from 'react-debug-tools/src/ReactDebugHooks';

import {formatDataForPreview} from 'react-devtools-shared/src/utils';

function formatHookPathValue(value: mixed): string | null {
  if (value === undefined) {
    return null;
  }
  return formatDataForPreview(value, true);
}

export default function getHookName(hook: HooksNode): string {
  const formattedHookPathValue = formatHookPathValue(hook.value);

  if (formattedHookPathValue === null) {
    return hook.name;
  }

  return `${hook.name}(${formattedHookPathValue})`;
}
