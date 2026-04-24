/* eslint-disable no-for-of-loops/no-for-of-loops */
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

// react-devtools-core/backend resolves to dist which isn't built in tests.
// Redirect to the source so devtools-custom's installHook works.
jest.mock('react-devtools-core/backend', () =>
  require('react-devtools-core/src/backend'),
);

import {getVersionedRenderImplementation} from 'react-devtools-shared/src/__tests__/utils';

function normalizeHookSource(hookSource) {
  if (hookSource == null) {
    return hookSource;
  }

  let fileName = hookSource.fileName;
  if (fileName != null) {
    fileName = fileName.replace(/\\/g, '/');
    const index = fileName.lastIndexOf('/react-devtools-custom/');
    if (index >= 0) {
      fileName = fileName.slice(index + 1);
    }
  }

  return {
    ...hookSource,
    columnNumber: 'removed by test helper',
    fileName,
    lineNumber: 'removed by test helper',
  };
}

function toChangeDescriptionsByDisplayName(commitChanges) {
  const map = new Map();
  for (const change of commitChanges) {
    const entry = {
      context: change.context,
      didHooksChange: change.didHooksChange,
      isFirstMount: change.isFirstMount,
      props: change.props,
      state: change.state,
    };
    if (change.hooks !== undefined) {
      entry.hooks = change.hooks
        ? change.hooks.map(h => ({
            hookIndex: h.hookIndex,
            hookName: h.hookName,
            hookPath: h.hookPath,
            hookSource: normalizeHookSource(h.hookSource),
          }))
        : change.hooks;
    }
    map.set(change.displayName, entry);
  }
  return map;
}

function installDevToolsCustomHook() {
  // setupTests.js has already installed the shared hook. Reset and reinstall
  // via devtools-custom so the tests exercise that API.
  delete global.__REACT_DEVTOOLS_GLOBAL_HOOK__;

  const {
    installHook,
    startRecording,
    endRecording,
    onCommitFiber,
  } = require('react-devtools-custom/index');

  installHook(globalThis, [], {
    appendComponentStack: true,
    breakOnConsoleErrors: false,
    showInlineWarningsAndErrors: true,
    hideConsoleLogsInStrictMode: false,
    disableSecondConsoleLogDimmingInStrictMode: false,
  });

  // Wrap onCommitFiberRoot so every React commit feeds devtools-custom.
  const hook = global.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const originalOnCommit = hook.onCommitFiberRoot;
  hook.onCommitFiberRoot = function (rendererID, root, priorityLevel) {
    originalOnCommit.call(this, rendererID, root, priorityLevel);
    onCommitFiber(root);
  };

  return {startRecording, endRecording, onCommitFiber};
}

describe('ProfilingCache', () => {
  let React;
  let ReactDOM;
  let ReactDOMClient;
  let Scheduler;
  let legacyRender;
  let utils;
  let startRecording;
  let endRecording;

  beforeEach(() => {
    utils = require('react-devtools-shared/src/__tests__/utils');
    utils.beforeEachProfiling();

    legacyRender = utils.legacyRender;

    ({startRecording, endRecording} = installDevToolsCustomHook());

    React = require('react');
    ReactDOM = require('react-dom');
    ReactDOMClient = require('react-dom/client');
    Scheduler = require('scheduler');
  });

  const {render, getContainer} = getVersionedRenderImplementation();

  // @reactVersion >= 16.9
  it('should collect data for each commit', () => {
    const Parent = ({count}) => {
      Scheduler.unstable_advanceTime(10);
      const children = new Array(count)
        .fill(true)
        .map((_, index) => <Child key={index} duration={index} />);
      return (
        <React.Fragment>
          {children}
          <MemoizedChild duration={1} />
        </React.Fragment>
      );
    };
    const Child = ({duration}) => {
      Scheduler.unstable_advanceTime(duration);
      return null;
    };
    const MemoizedChild = React.memo(Child);

    utils.act(() => startRecording());
    utils.act(() => render(<Parent count={2} />));
    utils.act(() => render(<Parent count={3} />));
    utils.act(() => render(<Parent count={1} />));
    utils.act(() => render(<Parent count={0} />));
    let recorded;
    utils.act(() => {
      recorded = endRecording();
    });

    expect(recorded).toHaveLength(4);
    recorded.forEach(commit => {
      expect(commit.some(c => c.displayName === 'Parent')).toBe(true);
    });
  });

  // @reactVersion >= 16.9
  it('should include render durations for each rendered fiber', () => {
    function Parent() {
      Scheduler.unstable_advanceTime(10);
      return <Child />;
    }

    function Child() {
      Scheduler.unstable_advanceTime(5);
      return null;
    }

    utils.act(() => startRecording());
    utils.act(() => render(<Parent />));
    let recorded;
    utils.act(() => {
      recorded = endRecording();
    });

    expect(recorded).toHaveLength(1);

    const parentChange = recorded[0].find(
      change => change.displayName === 'Parent',
    );
    const childChange = recorded[0].find(
      change => change.displayName === 'Child',
    );

    expect(parentChange).toMatchObject({
      actualDuration: 15,
      selfDuration: 10,
    });
    expect(childChange).toMatchObject({
      actualDuration: 5,
      selfDuration: 5,
    });
  });

  // @reactVersion >= 18.0
  it('should properly detect changed hooks', () => {
    const Context = React.createContext(0);

    function reducer(state, action) {
      switch (action.type) {
        case 'invert':
          return {value: !state.value};
        default:
          throw new Error();
      }
    }

    let snapshot = 0;
    function getServerSnapshot() {
      return snapshot;
    }
    function getClientSnapshot() {
      return snapshot;
    }

    let syncExternalStoreCallback;
    function subscribe(callback) {
      syncExternalStoreCallback = callback;
    }

    let dispatch = null;
    let setState = null;

    const Component = ({count, string}) => {
      // These hooks may change and initiate re-renders.
      setState = React.useState('abc')[1];
      dispatch = React.useReducer(reducer, {value: true})[1];
      React.useSyncExternalStore(
        subscribe,
        getClientSnapshot,
        getServerSnapshot,
      );

      // This hook's return value may change between renders,
      // but the hook itself isn't stateful.
      React.useContext(Context);

      // These hooks never change in a way that schedules an update.
      React.useCallback(() => () => {}, [string]);
      React.useMemo(() => string, [string]);
      React.useCallback(() => () => {}, [count]);
      React.useMemo(() => count, [count]);
      React.useCallback(() => () => {});
      React.useMemo(() => string);

      // These hooks never change in a way that schedules an update.
      React.useEffect(() => {}, [string]);
      React.useLayoutEffect(() => {}, [string]);
      React.useEffect(() => {}, [count]);
      React.useLayoutEffect(() => {}, [count]);
      React.useEffect(() => {});
      React.useLayoutEffect(() => {});

      return null;
    };

    utils.act(() => startRecording());
    utils.act(() =>
      render(
        <Context.Provider value={true}>
          <Component count={1} />
        </Context.Provider>,
      ),
    );

    const realDispatch = dispatch;
    const realSetState = setState;

    // Second render has no changed hooks, only changed props.
    utils.act(() =>
      render(
        <Context.Provider value={true}>
          <Component count={2} />
        </Context.Provider>,
      ),
    );

    // Third render has a changed reducer hook.
    utils.act(() => realDispatch({type: 'invert'}));

    // Fourth render has a changed state hook.
    utils.act(() => realSetState('def'));

    // Fifth render has a changed context value, but no changed hook.
    utils.act(() =>
      render(
        <Context.Provider value={false}>
          <Component count={2} />
        </Context.Provider>,
      ),
    );

    // 6th render is triggered by a sync external store change.
    utils.act(() => {
      snapshot++;
      syncExternalStoreCallback();
    });

    let recorded;
    utils.act(() => {
      recorded = endRecording();
    });

    const changeDescriptions = recorded.map(commit =>
      toChangeDescriptionsByDisplayName(
        commit.filter(c => c.displayName === 'Component'),
      ),
    );
    expect(changeDescriptions).toHaveLength(6);
    // 1st render: No change
    expect(changeDescriptions[0]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": null,
          "didHooksChange": false,
          "isFirstMount": true,
          "props": null,
          "state": null,
        },
      }
    `);

    // 2nd render: Changed props
    expect(changeDescriptions[1]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": false,
          "hooks": [],
          "isFirstMount": false,
          "props": [
            "count",
          ],
          "state": null,
        },
      }
    `);

    // 3rd render: Changed useReducer
    expect(changeDescriptions[2]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 1,
              "hookName": "Reducer",
              "hookPath": [
                "Reducer",
              ],
              "hookSource": {
                "columnNumber": "removed by test helper",
                "fileName": "react-devtools-custom/src/__tests__/profilingCache-test.js",
                "functionName": "Component",
                "lineNumber": "removed by test helper",
              },
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 4th render: Changed useState
    expect(changeDescriptions[3]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 0,
              "hookName": "State",
              "hookPath": [
                "State",
              ],
              "hookSource": {
                "columnNumber": "removed by test helper",
                "fileName": "react-devtools-custom/src/__tests__/profilingCache-test.js",
                "functionName": "Component",
                "lineNumber": "removed by test helper",
              },
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 5th render: Changed context
    expect(changeDescriptions[4]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": true,
          "didHooksChange": false,
          "hooks": [],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 6th render: Sync external store
    expect(changeDescriptions[5]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 2,
              "hookName": "SyncExternalStore",
              "hookPath": [
                "SyncExternalStore",
              ],
              "hookSource": {
                "columnNumber": "removed by test helper",
                "fileName": "react-devtools-custom/src/__tests__/profilingCache-test.js",
                "functionName": "Component",
                "lineNumber": "removed by test helper",
              },
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);
  });

  // @reactVersion >= 19.0
  it('should detect what hooks changed in a render with custom and composite hooks', () => {
    let snapshot = 0;
    let syncExternalStoreCallback;

    function subscribe(callback) {
      syncExternalStoreCallback = callback;
      return () => {};
    }

    function getSnapshot() {
      return snapshot;
    }

    // Custom hook wrapping multiple primitive hooks
    function useCustomHook() {
      const [value, setValue] = React.useState('custom');
      React.useEffect(() => {}, [value]);
      return [value, setValue];
    }

    let setState = null;
    let startTransition = null;
    let actionStateDispatch = null;
    let setCustomValue = null;
    let setFinalState = null;

    const Component = () => {
      const [state, _setState] = React.useState('initial');
      setState = _setState;

      const storeValue = React.useSyncExternalStore(
        subscribe,
        getSnapshot,
        getSnapshot,
      );

      const [isPending, _startTransition] = React.useTransition();
      startTransition = _startTransition;

      const [actionState, _actionStateDispatch] = React.useActionState(
        (_prev, action) => action,
        'action-initial',
      );
      actionStateDispatch = _actionStateDispatch;

      const [customValue, _setCustomValue] = useCustomHook();
      setCustomValue = _setCustomValue;

      const [finalState, _setFinalState] = React.useState('final');
      setFinalState = _setFinalState;

      return `${state}-${storeValue}-${isPending}-${actionState}-${customValue}-${finalState}`;
    };

    utils.act(() => startRecording());
    utils.act(() => render(<Component />));

    const realSetState = setState;
    const realStartTransition = startTransition;
    const realActionStateDispatch = actionStateDispatch;
    const realSetCustomValue = setCustomValue;
    const realSetFinalState = setFinalState;

    utils.act(() => realSetState('changed'));

    utils.act(() => {
      snapshot = 1;
      syncExternalStoreCallback();
    });

    utils.act(() => {
      realStartTransition(() => {});
    });

    utils.act(() => realActionStateDispatch('action-changed'));

    utils.act(() => realSetCustomValue('custom-changed'));

    utils.act(() => realSetFinalState('final-changed'));

    let recorded;
    utils.act(() => {
      recorded = endRecording();
    });

    const changeDescriptions = recorded.map(commit =>
      toChangeDescriptionsByDisplayName(
        commit.filter(c => c.displayName === 'Component'),
      ),
    );
    expect(changeDescriptions).toHaveLength(8);

    // 1st render: Initial mount
    expect(changeDescriptions[0]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": null,
          "didHooksChange": false,
          "isFirstMount": true,
          "props": null,
          "state": null,
        },
      }
    `);

    // 2nd render: Changed hook 0 (useState)
    expect(changeDescriptions[1]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 0,
              "hookName": "State",
              "hookPath": [
                "State",
              ],
              "hookSource": {
                "columnNumber": "removed by test helper",
                "fileName": "react-devtools-custom/src/__tests__/profilingCache-test.js",
                "functionName": "Component",
                "lineNumber": "removed by test helper",
              },
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 3rd render: Changed hook 1 (useSyncExternalStore)
    expect(changeDescriptions[2]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 1,
              "hookName": "SyncExternalStore",
              "hookPath": [
                "SyncExternalStore",
              ],
              "hookSource": {
                "columnNumber": "removed by test helper",
                "fileName": "react-devtools-custom/src/__tests__/profilingCache-test.js",
                "functionName": "Component",
                "lineNumber": "removed by test helper",
              },
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 4th render: Changed hook 2 (useTransition - isPending becomes true)
    expect(changeDescriptions[3]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 2,
              "hookName": "Transition",
              "hookPath": [
                "Transition",
              ],
              "hookSource": {
                "columnNumber": "removed by test helper",
                "fileName": "react-devtools-custom/src/__tests__/profilingCache-test.js",
                "functionName": "Component",
                "lineNumber": "removed by test helper",
              },
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 5th render: Changed hook 2 (useTransition - isPending becomes false)
    expect(changeDescriptions[4]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 2,
              "hookName": "Transition",
              "hookPath": [
                "Transition",
              ],
              "hookSource": {
                "columnNumber": "removed by test helper",
                "fileName": "react-devtools-custom/src/__tests__/profilingCache-test.js",
                "functionName": "Component",
                "lineNumber": "removed by test helper",
              },
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 6th render: Changed hook 3 (useActionState)
    expect(changeDescriptions[5]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 3,
              "hookName": "ActionState",
              "hookPath": [
                "ActionState",
              ],
              "hookSource": {
                "columnNumber": "removed by test helper",
                "fileName": "react-devtools-custom/src/__tests__/profilingCache-test.js",
                "functionName": "Component",
                "lineNumber": "removed by test helper",
              },
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 7th render: Changed hook 4 (useState inside useCustomHook)
    expect(changeDescriptions[6]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 4,
              "hookName": "State",
              "hookPath": [
                "CustomHook",
                "State",
              ],
              "hookSource": {
                "columnNumber": "removed by test helper",
                "fileName": "react-devtools-custom/src/__tests__/profilingCache-test.js",
                "functionName": "useCustomHook",
                "lineNumber": "removed by test helper",
              },
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 8th render: Changed hook 6 (final useState)
    expect(changeDescriptions[7]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 6,
              "hookName": "State",
              "hookPath": [
                "State",
              ],
              "hookSource": {
                "columnNumber": "removed by test helper",
                "fileName": "react-devtools-custom/src/__tests__/profilingCache-test.js",
                "functionName": "Component",
                "lineNumber": "removed by test helper",
              },
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);
  });

  // @reactVersion >= 19.0
  it('should detect context changes or lack of changes with conditional use()', () => {
    const ContextA = React.createContext(0);
    const ContextB = React.createContext(1);
    let setState = null;

    const Component = () => {
      let state;
      [state, setState] = React.useState('abc');

      let result = state;

      if (state.includes('a')) {
        result += React.use(ContextA);
      }

      result += React.use(ContextB);

      return result;
    };

    utils.act(() =>
      render(
        <ContextA.Provider value={1}>
          <ContextB.Provider value={1}>
            <Component />
          </ContextB.Provider>
        </ContextA.Provider>,
      ),
    );

    const realSetState = setState;

    utils.act(() => startRecording());

    // First render changes Context.
    utils.act(() =>
      render(
        <ContextA.Provider value={0}>
          <ContextB.Provider value={1}>
            <Component />
          </ContextB.Provider>
        </ContextA.Provider>,
      ),
    );

    // Second render has no changed Context, only changed state.
    utils.act(() => realSetState('def'));

    let recorded;
    utils.act(() => {
      recorded = endRecording();
    });

    const changeDescriptions = recorded.map(commit =>
      toChangeDescriptionsByDisplayName(
        commit.filter(c => c.displayName === 'Component'),
      ),
    );
    expect(changeDescriptions).toHaveLength(2);

    // 1st render: Change to Context
    expect(changeDescriptions[0]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": true,
          "didHooksChange": false,
          "hooks": [],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 2nd render: Change to State
    expect(changeDescriptions[1]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 0,
              "hookName": "State",
              "hookPath": [
                "State",
              ],
              "hookSource": {
                "columnNumber": "removed by test helper",
                "fileName": "react-devtools-custom/src/__tests__/profilingCache-test.js",
                "functionName": "Component",
                "lineNumber": "removed by test helper",
              },
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);
  });

  // @reactVersion >= 16.9
  it('should use only direct custom hook values when formatting hook paths', () => {
    function useConditionalStateHook(isRandom) {
      const x = isRandom ? 1 : 0;
      const [value, setValue] = React.useState(x);
      return [value, setValue];
    }

    function useCustomHook(label) {
      React.useDebugValue(label);
      const [value, setValue] = React.useState(label);
      return [value, setValue];
    }

    let setTopLevelState = null;
    let setConditionalState = null;
    let setNumberLabelState = null;
    let setStringLabelState = null;
    let setUndefinedLabelState = null;
    let setMissingLabelState = null;

    const Component = () => {
      const [, _setTopLevelState] = React.useState(4);
      setTopLevelState = _setTopLevelState;

      const [, _setConditionalState] = useConditionalStateHook(true);
      setConditionalState = _setConditionalState;

      const [, _setNumberLabelState] = useCustomHook(10);
      setNumberLabelState = _setNumberLabelState;

      const [, _setStringLabelState] = useCustomHook('10');
      setStringLabelState = _setStringLabelState;

      const [, _setUndefinedLabelState] = useCustomHook(undefined);
      setUndefinedLabelState = _setUndefinedLabelState;

      const [, _setMissingLabelState] = useCustomHook();
      setMissingLabelState = _setMissingLabelState;

      return null;
    };

    utils.act(() => render(<Component />));

    const realSetTopLevelState = setTopLevelState;
    const realSetConditionalState = setConditionalState;
    const realSetNumberLabelState = setNumberLabelState;
    const realSetStringLabelState = setStringLabelState;
    const realSetUndefinedLabelState = setUndefinedLabelState;
    const realSetMissingLabelState = setMissingLabelState;

    utils.act(() => startRecording());

    utils.act(() => realSetTopLevelState(5));
    utils.act(() => realSetConditionalState(2));
    utils.act(() => realSetNumberLabelState(11));
    utils.act(() => realSetStringLabelState('11'));
    utils.act(() => realSetUndefinedLabelState('defined'));
    utils.act(() => realSetMissingLabelState('later'));

    let recorded;
    utils.act(() => {
      recorded = endRecording();
    });

    const changeDescriptions = recorded.map(commit => {
      const descriptions = toChangeDescriptionsByDisplayName(
        commit.filter(c => c.displayName === 'Component'),
      );
      return new Map(
        Array.from(descriptions.entries()).map(([displayName, entry]) => [
          displayName,
          {
            ...entry,
            hooks:
              entry.hooks == null
                ? entry.hooks
                : entry.hooks.map(({hookSource, ...hook}) => hook),
          },
        ]),
      );
    });

    expect(changeDescriptions).toHaveLength(6);

    // 1st render: top-level useState(4)
    expect(changeDescriptions[0]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 0,
              "hookName": "State",
              "hookPath": [
                "State",
              ],
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 2nd render: useConditionalStateHook with subhook state derived from x
    expect(changeDescriptions[1]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 1,
              "hookName": "State",
              "hookPath": [
                "ConditionalStateHook",
                "State",
              ],
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 3rd render: useCustomHook(10)
    expect(changeDescriptions[2]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 2,
              "hookName": "State",
              "hookPath": [
                "CustomHook(10)",
                "State",
              ],
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 4th render: useCustomHook("10")
    expect(changeDescriptions[3]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 3,
              "hookName": "State",
              "hookPath": [
                "CustomHook("10")",
                "State",
              ],
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 5th render: useCustomHook(undefined)
    expect(changeDescriptions[4]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 4,
              "hookName": "State",
              "hookPath": [
                "CustomHook",
                "State",
              ],
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);

    // 6th render: useCustomHook() without an argument
    expect(changeDescriptions[5]).toMatchInlineSnapshot(`
      Map {
        "Component" => {
          "context": false,
          "didHooksChange": true,
          "hooks": [
            {
              "hookIndex": 5,
              "hookName": "State",
              "hookPath": [
                "CustomHook",
                "State",
              ],
            },
          ],
          "isFirstMount": false,
          "props": [],
          "state": null,
        },
      }
    `);
  });

  // @reactVersion >= 16.9
  it('should collect data for each rendered fiber', () => {
    const Parent = ({count}) => {
      Scheduler.unstable_advanceTime(10);
      const children = new Array(count)
        .fill(true)
        .map((_, index) => <Child key={index} duration={index} />);
      return (
        <React.Fragment>
          {children}
          <MemoizedChild duration={1} />
        </React.Fragment>
      );
    };
    const Child = ({duration}) => {
      Scheduler.unstable_advanceTime(duration);
      return null;
    };
    const MemoizedChild = React.memo(Child);

    utils.act(() => startRecording());
    utils.act(() => render(<Parent count={1} />));
    utils.act(() => render(<Parent count={2} />));
    utils.act(() => render(<Parent count={3} />));
    let recorded;
    utils.act(() => {
      recorded = endRecording();
    });

    // 3 commits recorded, each includes Parent in its fiber change list.
    expect(recorded).toHaveLength(3);
    recorded.forEach(commit => {
      expect(commit.some(c => c.displayName === 'Parent')).toBe(true);
    });

    // Every commit renders at least some Child (the MemoizedChild on first
    // mount, plus new Children on subsequent renders).
    recorded.forEach(commit => {
      expect(commit.some(c => c.displayName === 'Child')).toBe(true);
    });
  });

  // @reactVersion >= 18.0.0
  // @reactVersion <= 18.2.0
  it('should handle unexpectedly shallow suspense trees for react v[18.0.0 - 18.2.0] (legacy render)', () => {
    utils.act(() => startRecording());
    utils.act(() =>
      legacyRender(<React.Suspense />, document.createElement('div')),
    );
    let recorded;
    utils.act(() => {
      recorded = endRecording();
    });

    // One commit, no component fibers inside (Suspense is not tracked).
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toEqual([]);
  });

  // @reactVersion >= 18.0.0
  // @reactVersion <= 18.2.0
  it('should handle unexpectedly shallow suspense trees for react v[18.0.0 - 18.2.0] (createRoot)', () => {
    utils.act(() => startRecording());
    utils.act(() => render(<React.Suspense />));
    let recorded;
    utils.act(() => {
      recorded = endRecording();
    });

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toEqual([]);
  });

  // @reactVersion > 18.2.0
  it('should handle unexpectedly shallow suspense trees', () => {
    utils.act(() => startRecording());
    utils.act(() => render(<React.Suspense />));
    let recorded;
    utils.act(() => {
      recorded = endRecording();
    });

    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toEqual([]);
  });

  // See https://github.com/facebook/react/issues/18831
  // @reactVersion >= 16.9
  it('should not crash during route transitions with Suspense', () => {
    const RouterContext = React.createContext();

    function App() {
      return (
        <Router>
          <Switch>
            <Route path="/">
              <Home />
            </Route>
            <Route path="/about">
              <About />
            </Route>
          </Switch>
        </Router>
      );
    }

    const Home = () => {
      return (
        <React.Suspense>
          <Link path="/about">Home</Link>
        </React.Suspense>
      );
    };

    const About = () => <div>About</div>;

    function Router({children}) {
      const [path, setPath] = React.useState('/');
      return (
        <RouterContext.Provider value={{path, setPath}}>
          {children}
        </RouterContext.Provider>
      );
    }

    function Switch({children}) {
      return (
        <RouterContext.Consumer>
          {context => {
            let element = null;
            React.Children.forEach(children, child => {
              if (context.path === child.props.path) {
                element = child.props.children;
              }
            });
            return element ? React.cloneElement(element) : null;
          }}
        </RouterContext.Consumer>
      );
    }

    function Route({children, path}) {
      return null;
    }

    const linkRef = React.createRef();

    function Link({children, path}) {
      return (
        <RouterContext.Consumer>
          {context => {
            return (
              <button ref={linkRef} onClick={() => context.setPath(path)}>
                {children}
              </button>
            );
          }}
        </RouterContext.Consumer>
      );
    }

    utils.act(() => render(<App />));
    expect(getContainer().textContent).toBe('Home');
    utils.act(() => startRecording());
    utils.act(() =>
      linkRef.current.dispatchEvent(
        new MouseEvent('click', {bubbles: true, cancelable: true}),
      ),
    );
    utils.act(() => endRecording());
    expect(getContainer().textContent).toBe('About');
  });

  // @reactVersion >= 18.0
  it('should resolve changed state hooks after zero-slot hooks like useContext', () => {
    const Context = React.createContext(0);

    let setState = null;
    const Component = () => {
      React.useContext(Context);

      const [, _setState] = React.useState('initial');
      setState = _setState;

      return null;
    };

    utils.act(() => startRecording());
    utils.act(() =>
      render(
        <Context.Provider value={0}>
          <Component />
        </Context.Provider>,
      ),
    );

    const realSetState = setState;
    utils.act(() => realSetState('updated'));

    let recorded;
    utils.act(() => {
      recorded = endRecording();
    });

    const changeDescriptions = recorded.map(commit =>
      toChangeDescriptionsByDisplayName(commit),
    );

    expect(changeDescriptions[1].get('Component')).toMatchObject({
      context: false,
      didHooksChange: true,
      hooks: [
        {
          hookIndex: 0,
          hookName: 'State',
          hookPath: ['State'],
        },
      ],
      isFirstMount: false,
      props: [],
      state: null,
    });
  });
});
