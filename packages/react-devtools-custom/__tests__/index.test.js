/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

describe('react-devtools-custom', () => {
  let initialize;
  let installHook;

  beforeEach(() => {
    jest.resetModules();
    initialize = jest.fn();

    jest.doMock('react-devtools-core/backend', () => ({
      initialize,
    }));

    ({installHook} = require('../index'));
    delete global.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  });

  afterEach(() => {
    delete global.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  });

  it('throws when target is not an object', () => {
    expect(() => installHook(null, [])).toThrow(
      'installHook(target) requires a global object target.',
    );
  });

  it('throws when target is not globalThis', () => {
    expect(() => installHook({}, [])).toThrow(
      'react-devtools-custom installHook currently only supports globalThis/window as the target.',
    );
  });

  it('initializes the backend and returns the installed hook', () => {
    const componentFilters = [{type: 1, value: 7, isEnabled: true}];
    const settings = {appendComponentStack: true};
    const profilingSettings = {recordChangeDescriptions: true};
    const hook = {renderers: new Map()};

    global.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;

    const result = installHook(
      globalThis,
      componentFilters,
      settings,
      true,
      profilingSettings,
    );

    expect(initialize).toHaveBeenCalledWith(
      settings,
      true,
      profilingSettings,
      componentFilters,
    );
    expect(result).toBe(hook);
  });
});
