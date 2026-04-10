/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 521:
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;(function (root, factory) {
  'use strict';

  if (true) {
    !(__WEBPACK_AMD_DEFINE_ARRAY__ = [__webpack_require__(520)], __WEBPACK_AMD_DEFINE_FACTORY__ = (factory),
		__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
		(__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__),
		__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
  } else {}
})(this, function ErrorStackParser(StackFrame) {
  'use strict';

  var FIREFOX_SAFARI_STACK_REGEXP = /(^|@)\S+:\d+/;
  var CHROME_IE_STACK_REGEXP = /^\s*at .*(\S+:\d+|\(native\))/m;
  var SAFARI_NATIVE_CODE_REGEXP = /^(eval@)?(\[native code])?$/;
  return {
    parse: function ErrorStackParser$$parse(error) {
      if (typeof error.stacktrace !== 'undefined' || typeof error['opera#sourceloc'] !== 'undefined') {
        return this.parseOpera(error);
      } else if (error.stack && error.stack.match(CHROME_IE_STACK_REGEXP)) {
        return this.parseV8OrIE(error);
      } else if (error.stack) {
        return this.parseFFOrSafari(error);
      } else {
        throw new Error('Cannot parse given Error object');
      }
    },
    extractLocation: function ErrorStackParser$$extractLocation(urlLike) {
      if (urlLike.indexOf(':') === -1) {
        return [urlLike];
      }
      var regExp = /(.+?)(?::(\d+))?(?::(\d+))?$/;
      var parts = regExp.exec(urlLike.replace(/[()]/g, ''));
      return [parts[1], parts[2] || undefined, parts[3] || undefined];
    },
    parseV8OrIE: function ErrorStackParser$$parseV8OrIE(error) {
      var filtered = error.stack.split('\n').filter(function (line) {
        return !!line.match(CHROME_IE_STACK_REGEXP);
      }, this);
      return filtered.map(function (line) {
        if (line.indexOf('(eval ') > -1) {
          line = line.replace(/eval code/g, 'eval').replace(/(\(eval at [^()]*)|(,.*$)/g, '');
        }
        var sanitizedLine = line.replace(/^\s+/, '').replace(/\(eval code/g, '(').replace(/^.*?\s+/, '');
        var location = sanitizedLine.match(/ (\(.+\)$)/);
        sanitizedLine = location ? sanitizedLine.replace(location[0], '') : sanitizedLine;
        var locationParts = this.extractLocation(location ? location[1] : sanitizedLine);
        var functionName = location && sanitizedLine || undefined;
        var fileName = ['eval', '<anonymous>'].indexOf(locationParts[0]) > -1 ? undefined : locationParts[0];
        return new StackFrame({
          functionName: functionName,
          fileName: fileName,
          lineNumber: locationParts[1],
          columnNumber: locationParts[2],
          source: line
        });
      }, this);
    },
    parseFFOrSafari: function ErrorStackParser$$parseFFOrSafari(error) {
      var filtered = error.stack.split('\n').filter(function (line) {
        return !line.match(SAFARI_NATIVE_CODE_REGEXP);
      }, this);
      return filtered.map(function (line) {
        if (line.indexOf(' > eval') > -1) {
          line = line.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g, ':$1');
        }
        if (line.indexOf('@') === -1 && line.indexOf(':') === -1) {
          return new StackFrame({
            functionName: line
          });
        } else {
          var functionNameRegex = /((.*".+"[^@]*)?[^@]*)(?:@)/;
          var matches = line.match(functionNameRegex);
          var functionName = matches && matches[1] ? matches[1] : undefined;
          var locationParts = this.extractLocation(line.replace(functionNameRegex, ''));
          return new StackFrame({
            functionName: functionName,
            fileName: locationParts[0],
            lineNumber: locationParts[1],
            columnNumber: locationParts[2],
            source: line
          });
        }
      }, this);
    },
    parseOpera: function ErrorStackParser$$parseOpera(e) {
      if (!e.stacktrace || e.message.indexOf('\n') > -1 && e.message.split('\n').length > e.stacktrace.split('\n').length) {
        return this.parseOpera9(e);
      } else if (!e.stack) {
        return this.parseOpera10(e);
      } else {
        return this.parseOpera11(e);
      }
    },
    parseOpera9: function ErrorStackParser$$parseOpera9(e) {
      var lineRE = /Line (\d+).*script (?:in )?(\S+)/i;
      var lines = e.message.split('\n');
      var result = [];
      for (var i = 2, len = lines.length; i < len; i += 2) {
        var match = lineRE.exec(lines[i]);
        if (match) {
          result.push(new StackFrame({
            fileName: match[2],
            lineNumber: match[1],
            source: lines[i]
          }));
        }
      }
      return result;
    },
    parseOpera10: function ErrorStackParser$$parseOpera10(e) {
      var lineRE = /Line (\d+).*script (?:in )?(\S+)(?:: In function (\S+))?$/i;
      var lines = e.stacktrace.split('\n');
      var result = [];
      for (var i = 0, len = lines.length; i < len; i += 2) {
        var match = lineRE.exec(lines[i]);
        if (match) {
          result.push(new StackFrame({
            functionName: match[3] || undefined,
            fileName: match[2],
            lineNumber: match[1],
            source: lines[i]
          }));
        }
      }
      return result;
    },
    parseOpera11: function ErrorStackParser$$parseOpera11(error) {
      var filtered = error.stack.split('\n').filter(function (line) {
        return !!line.match(FIREFOX_SAFARI_STACK_REGEXP) && !line.match(/^Error created at/);
      }, this);
      return filtered.map(function (line) {
        var tokens = line.split('@');
        var locationParts = this.extractLocation(tokens.pop());
        var functionCall = tokens.shift() || '';
        var functionName = functionCall.replace(/<anonymous function(: (\w+))?>/, '$2').replace(/\([^)]*\)/g, '') || undefined;
        var argsRaw;
        if (functionCall.match(/\(([^)]*)\)/)) {
          argsRaw = functionCall.replace(/^[^(]+\(([^)]*)\)$/, '$1');
        }
        var args = argsRaw === undefined || argsRaw === '[arguments not available]' ? undefined : argsRaw.split(',');
        return new StackFrame({
          functionName: functionName,
          args: args,
          fileName: locationParts[0],
          lineNumber: locationParts[1],
          columnNumber: locationParts[2],
          source: line
        });
      }, this);
    }
  };
});

/***/ }),

/***/ 520:
/***/ (function(module, exports) {

var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;(function (root, factory) {
  'use strict';

  if (true) {
    !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_FACTORY__ = (factory),
		__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
		(__WEBPACK_AMD_DEFINE_FACTORY__.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__)) : __WEBPACK_AMD_DEFINE_FACTORY__),
		__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
  } else {}
})(this, function () {
  'use strict';

  function _isNumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }
  function _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.substring(1);
  }
  function _getter(p) {
    return function () {
      return this[p];
    };
  }
  var booleanProps = ['isConstructor', 'isEval', 'isNative', 'isToplevel'];
  var numericProps = ['columnNumber', 'lineNumber'];
  var stringProps = ['fileName', 'functionName', 'source'];
  var arrayProps = ['args'];
  var objectProps = ['evalOrigin'];
  var props = booleanProps.concat(numericProps, stringProps, arrayProps, objectProps);
  function StackFrame(obj) {
    if (!obj) return;
    for (var i = 0; i < props.length; i++) {
      if (obj[props[i]] !== undefined) {
        this['set' + _capitalize(props[i])](obj[props[i]]);
      }
    }
  }
  StackFrame.prototype = {
    getArgs: function () {
      return this.args;
    },
    setArgs: function (v) {
      if (Object.prototype.toString.call(v) !== '[object Array]') {
        throw new TypeError('Args must be an Array');
      }
      this.args = v;
    },
    getEvalOrigin: function () {
      return this.evalOrigin;
    },
    setEvalOrigin: function (v) {
      if (v instanceof StackFrame) {
        this.evalOrigin = v;
      } else if (v instanceof Object) {
        this.evalOrigin = new StackFrame(v);
      } else {
        throw new TypeError('Eval Origin must be an Object or StackFrame');
      }
    },
    toString: function () {
      var fileName = this.getFileName() || '';
      var lineNumber = this.getLineNumber() || '';
      var columnNumber = this.getColumnNumber() || '';
      var functionName = this.getFunctionName() || '';
      if (this.getIsEval()) {
        if (fileName) {
          return '[eval] (' + fileName + ':' + lineNumber + ':' + columnNumber + ')';
        }
        return '[eval]:' + lineNumber + ':' + columnNumber;
      }
      if (functionName) {
        return functionName + ' (' + fileName + ':' + lineNumber + ':' + columnNumber + ')';
      }
      return fileName + ':' + lineNumber + ':' + columnNumber;
    }
  };
  StackFrame.fromString = function StackFrame$$fromString(str) {
    var argsStartIndex = str.indexOf('(');
    var argsEndIndex = str.lastIndexOf(')');
    var functionName = str.substring(0, argsStartIndex);
    var args = str.substring(argsStartIndex + 1, argsEndIndex).split(',');
    var locationString = str.substring(argsEndIndex + 1);
    if (locationString.indexOf('@') === 0) {
      var parts = /@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(locationString, '');
      var fileName = parts[1];
      var lineNumber = parts[2];
      var columnNumber = parts[3];
    }
    return new StackFrame({
      functionName: functionName,
      args: args || undefined,
      fileName: fileName,
      lineNumber: lineNumber || undefined,
      columnNumber: columnNumber || undefined
    });
  };
  for (var i = 0; i < booleanProps.length; i++) {
    StackFrame.prototype['get' + _capitalize(booleanProps[i])] = _getter(booleanProps[i]);
    StackFrame.prototype['set' + _capitalize(booleanProps[i])] = function (p) {
      return function (v) {
        this[p] = Boolean(v);
      };
    }(booleanProps[i]);
  }
  for (var j = 0; j < numericProps.length; j++) {
    StackFrame.prototype['get' + _capitalize(numericProps[j])] = _getter(numericProps[j]);
    StackFrame.prototype['set' + _capitalize(numericProps[j])] = function (p) {
      return function (v) {
        if (!_isNumber(v)) {
          throw new TypeError(p + ' must be a Number');
        }
        this[p] = Number(v);
      };
    }(numericProps[j]);
  }
  for (var k = 0; k < stringProps.length; k++) {
    StackFrame.prototype['get' + _capitalize(stringProps[k])] = _getter(stringProps[k]);
    StackFrame.prototype['set' + _capitalize(stringProps[k])] = function (p) {
      return function (v) {
        this[p] = String(v);
      };
    }(stringProps[k]);
  }
  return StackFrame;
});

/***/ }),

/***/ 910:
/***/ ((module) => {

"use strict";
module.exports = require("react-devtools-core/backend");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "installHook": () => (/* binding */ installHook),
  "onCommitFiber": () => (/* reexport */ onCommitFiber)
});

// EXTERNAL MODULE: ../react-debug-tools/node_modules/error-stack-parser/error-stack-parser.js
var error_stack_parser = __webpack_require__(521);
var error_stack_parser_default = /*#__PURE__*/__webpack_require__.n(error_stack_parser);
;// CONCATENATED MODULE: ../shared/assign.js
const assign_assign = Object.assign;
/* harmony default export */ const shared_assign = (assign_assign);
;// CONCATENATED MODULE: external "react"
const external_react_namespaceObject = require("react");
;// CONCATENATED MODULE: ../shared/ReactSharedInternals.js

const ReactSharedInternals = external_react_namespaceObject.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
/* harmony default export */ const shared_ReactSharedInternals = (ReactSharedInternals);
;// CONCATENATED MODULE: ../react-reconciler/src/ReactWorkTags.js
const FunctionComponent = 0;
const ClassComponent = 1;
const HostRoot = 3;
const HostPortal = 4;
const HostComponent = 5;
const HostText = 6;
const Fragment = 7;
const Mode = 8;
const ContextConsumer = 9;
const ContextProvider = 10;
const ForwardRef = 11;
const Profiler = 12;
const SuspenseComponent = 13;
const MemoComponent = 14;
const SimpleMemoComponent = 15;
const LazyComponent = 16;
const IncompleteClassComponent = 17;
const DehydratedFragment = 18;
const SuspenseListComponent = 19;
const ScopeComponent = 21;
const OffscreenComponent = 22;
const LegacyHiddenComponent = 23;
const CacheComponent = 24;
const TracingMarkerComponent = 25;
const HostHoistable = 26;
const HostSingleton = 27;
const IncompleteFunctionComponent = 28;
const Throw = 29;
const ViewTransitionComponent = 30;
const ActivityComponent = 31;
;// CONCATENATED MODULE: ../shared/ReactSymbols.js
const REACT_LEGACY_ELEMENT_TYPE = Symbol.for('react.element');
const REACT_ELEMENT_TYPE = Symbol.for('react.transitional.element');
const REACT_PORTAL_TYPE = Symbol.for('react.portal');
const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');
const REACT_STRICT_MODE_TYPE = Symbol.for('react.strict_mode');
const REACT_PROFILER_TYPE = Symbol.for('react.profiler');
const REACT_CONSUMER_TYPE = Symbol.for('react.consumer');
const REACT_CONTEXT_TYPE = Symbol.for('react.context');
const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
const REACT_SUSPENSE_TYPE = Symbol.for('react.suspense');
const REACT_SUSPENSE_LIST_TYPE = Symbol.for('react.suspense_list');
const REACT_MEMO_TYPE = Symbol.for('react.memo');
const REACT_LAZY_TYPE = Symbol.for('react.lazy');
const REACT_SCOPE_TYPE = Symbol.for('react.scope');
const REACT_ACTIVITY_TYPE = Symbol.for('react.activity');
const REACT_LEGACY_HIDDEN_TYPE = Symbol.for('react.legacy_hidden');
const REACT_TRACING_MARKER_TYPE = Symbol.for('react.tracing_marker');
const REACT_MEMO_CACHE_SENTINEL = Symbol.for('react.memo_cache_sentinel');
const REACT_VIEW_TRANSITION_TYPE = Symbol.for('react.view_transition');
const MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
const FAUX_ITERATOR_SYMBOL = '@@iterator';
function getIteratorFn(maybeIterable) {
  if (maybeIterable === null || typeof maybeIterable !== 'object') {
    return null;
  }
  const maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
  if (typeof maybeIterator === 'function') {
    return maybeIterator;
  }
  return null;
}
const ASYNC_ITERATOR = Symbol.asyncIterator;
const REACT_OPTIMISTIC_KEY = Symbol.for('react.optimistic_key');
;// CONCATENATED MODULE: ../shared/hasOwnProperty.js
const hasOwnProperty_hasOwnProperty = Object.prototype.hasOwnProperty;
/* harmony default export */ const shared_hasOwnProperty = (hasOwnProperty_hasOwnProperty);
;// CONCATENATED MODULE: ../react-debug-tools/src/ReactDebugHooks.js






let hookLog = [];
let primitiveStackCache = null;
function getPrimitiveStackCache() {
  if (primitiveStackCache === null) {
    const cache = new Map();
    let readHookLog;
    try {
      Dispatcher.useContext({
        _currentValue: null
      });
      Dispatcher.useState(null);
      Dispatcher.useReducer((s, a) => s, null);
      Dispatcher.useRef(null);
      if (typeof Dispatcher.useCacheRefresh === 'function') {
        Dispatcher.useCacheRefresh();
      }
      Dispatcher.useLayoutEffect(() => {});
      Dispatcher.useInsertionEffect(() => {});
      Dispatcher.useEffect(() => {});
      Dispatcher.useImperativeHandle(undefined, () => null);
      Dispatcher.useDebugValue(null);
      Dispatcher.useCallback(() => {});
      Dispatcher.useTransition();
      Dispatcher.useSyncExternalStore(() => () => {}, () => null, () => null);
      Dispatcher.useDeferredValue(null);
      Dispatcher.useMemo(() => null);
      Dispatcher.useOptimistic(null, (s, a) => s);
      Dispatcher.useFormState((s, p) => s, null);
      Dispatcher.useActionState((s, p) => s, null);
      Dispatcher.useHostTransitionStatus();
      if (typeof Dispatcher.useMemoCache === 'function') {
        Dispatcher.useMemoCache(0);
      }
      if (typeof Dispatcher.use === 'function') {
        Dispatcher.use({
          $$typeof: REACT_CONTEXT_TYPE,
          _currentValue: null
        });
        Dispatcher.use({
          then() {},
          status: 'fulfilled',
          value: null
        });
        try {
          Dispatcher.use({
            then() {}
          });
        } catch (x) {}
      }
      Dispatcher.useId();
      if (typeof Dispatcher.useEffectEvent === 'function') {
        Dispatcher.useEffectEvent(args => {});
      }
    } finally {
      readHookLog = hookLog;
      hookLog = [];
    }
    for (let i = 0; i < readHookLog.length; i++) {
      const hook = readHookLog[i];
      cache.set(hook.primitive, error_stack_parser_default().parse(hook.stackError));
    }
    primitiveStackCache = cache;
  }
  return primitiveStackCache;
}
let currentFiber = null;
let currentHook = null;
let currentContextDependency = null;
let currentThenableIndex = 0;
let currentThenableState = null;
function nextHook() {
  const hook = currentHook;
  if (hook !== null) {
    currentHook = hook.next;
  }
  return hook;
}
function readContext(context) {
  if (currentFiber === null) {
    return context._currentValue;
  } else {
    if (currentContextDependency === null) {
      throw new Error('Context reads do not line up with context dependencies. This is a bug in React Debug Tools.');
    }
    let value;
    if (shared_hasOwnProperty.call(currentContextDependency, 'memoizedValue')) {
      value = currentContextDependency.memoizedValue;
      currentContextDependency = currentContextDependency.next;
    } else {
      value = context._currentValue;
    }
    return value;
  }
}
const SuspenseException = new Error("Suspense Exception: This is not a real error! It's an implementation " + 'detail of `use` to interrupt the current render. You must either ' + 'rethrow it immediately, or move the `use` call outside of the ' + '`try/catch` block. Capturing without rethrowing will lead to ' + 'unexpected behavior.\n\n' + 'To handle async errors, wrap your component in an error boundary, or ' + "call the promise's `.catch` method and pass the result to `use`.");
function use(usable) {
  if (usable !== null && typeof usable === 'object') {
    if (typeof usable.then === 'function') {
      const thenable = currentThenableState !== null && currentThenableIndex < currentThenableState.length ? currentThenableState[currentThenableIndex++] : usable;
      switch (thenable.status) {
        case 'fulfilled':
          {
            const fulfilledValue = thenable.value;
            hookLog.push({
              displayName: null,
              primitive: 'Promise',
              stackError: new Error(),
              value: fulfilledValue,
              debugInfo: thenable._debugInfo === undefined ? null : thenable._debugInfo,
              dispatcherHookName: 'Use'
            });
            return fulfilledValue;
          }
        case 'rejected':
          {
            const rejectedError = thenable.reason;
            throw rejectedError;
          }
      }
      hookLog.push({
        displayName: null,
        primitive: 'Unresolved',
        stackError: new Error(),
        value: thenable,
        debugInfo: thenable._debugInfo === undefined ? null : thenable._debugInfo,
        dispatcherHookName: 'Use'
      });
      throw SuspenseException;
    } else if (usable.$$typeof === REACT_CONTEXT_TYPE) {
      const context = usable;
      const value = readContext(context);
      hookLog.push({
        displayName: context.displayName || 'Context',
        primitive: 'Context (use)',
        stackError: new Error(),
        value,
        debugInfo: null,
        dispatcherHookName: 'Use'
      });
      return value;
    }
  }
  throw new Error('An unsupported type was passed to use(): ' + String(usable));
}
function useContext(context) {
  const value = readContext(context);
  hookLog.push({
    displayName: context.displayName || null,
    primitive: 'Context',
    stackError: new Error(),
    value: value,
    debugInfo: null,
    dispatcherHookName: 'Context'
  });
  return value;
}
function useState(initialState) {
  const hook = nextHook();
  const state = hook !== null ? hook.memoizedState : typeof initialState === 'function' ? initialState() : initialState;
  hookLog.push({
    displayName: null,
    primitive: 'State',
    stackError: new Error(),
    value: state,
    debugInfo: null,
    dispatcherHookName: 'State'
  });
  return [state, action => {}];
}
function useReducer(reducer, initialArg, init) {
  const hook = nextHook();
  let state;
  if (hook !== null) {
    state = hook.memoizedState;
  } else {
    state = init !== undefined ? init(initialArg) : initialArg;
  }
  hookLog.push({
    displayName: null,
    primitive: 'Reducer',
    stackError: new Error(),
    value: state,
    debugInfo: null,
    dispatcherHookName: 'Reducer'
  });
  return [state, action => {}];
}
function useRef(initialValue) {
  const hook = nextHook();
  const ref = hook !== null ? hook.memoizedState : {
    current: initialValue
  };
  hookLog.push({
    displayName: null,
    primitive: 'Ref',
    stackError: new Error(),
    value: ref.current,
    debugInfo: null,
    dispatcherHookName: 'Ref'
  });
  return ref;
}
function useCacheRefresh() {
  const hook = nextHook();
  hookLog.push({
    displayName: null,
    primitive: 'CacheRefresh',
    stackError: new Error(),
    value: hook !== null ? hook.memoizedState : function refresh() {},
    debugInfo: null,
    dispatcherHookName: 'CacheRefresh'
  });
  return () => {};
}
function useLayoutEffect(create, inputs) {
  nextHook();
  hookLog.push({
    displayName: null,
    primitive: 'LayoutEffect',
    stackError: new Error(),
    value: create,
    debugInfo: null,
    dispatcherHookName: 'LayoutEffect'
  });
}
function useInsertionEffect(create, inputs) {
  nextHook();
  hookLog.push({
    displayName: null,
    primitive: 'InsertionEffect',
    stackError: new Error(),
    value: create,
    debugInfo: null,
    dispatcherHookName: 'InsertionEffect'
  });
}
function useEffect(create, deps) {
  nextHook();
  hookLog.push({
    displayName: null,
    primitive: 'Effect',
    stackError: new Error(),
    value: create,
    debugInfo: null,
    dispatcherHookName: 'Effect'
  });
}
function useImperativeHandle(ref, create, inputs) {
  nextHook();
  let instance = undefined;
  if (ref !== null && typeof ref === 'object') {
    instance = ref.current;
  }
  hookLog.push({
    displayName: null,
    primitive: 'ImperativeHandle',
    stackError: new Error(),
    value: instance,
    debugInfo: null,
    dispatcherHookName: 'ImperativeHandle'
  });
}
function useDebugValue(value, formatterFn) {
  hookLog.push({
    displayName: null,
    primitive: 'DebugValue',
    stackError: new Error(),
    value: typeof formatterFn === 'function' ? formatterFn(value) : value,
    debugInfo: null,
    dispatcherHookName: 'DebugValue'
  });
}
function useCallback(callback, inputs) {
  const hook = nextHook();
  hookLog.push({
    displayName: null,
    primitive: 'Callback',
    stackError: new Error(),
    value: hook !== null ? hook.memoizedState[0] : callback,
    debugInfo: null,
    dispatcherHookName: 'Callback'
  });
  return callback;
}
function useMemo(nextCreate, inputs) {
  const hook = nextHook();
  const value = hook !== null ? hook.memoizedState[0] : nextCreate();
  hookLog.push({
    displayName: null,
    primitive: 'Memo',
    stackError: new Error(),
    value,
    debugInfo: null,
    dispatcherHookName: 'Memo'
  });
  return value;
}
function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
  const hook = nextHook();
  nextHook();
  const value = hook !== null ? hook.memoizedState : getSnapshot();
  hookLog.push({
    displayName: null,
    primitive: 'SyncExternalStore',
    stackError: new Error(),
    value,
    debugInfo: null,
    dispatcherHookName: 'SyncExternalStore'
  });
  return value;
}
function useTransition() {
  const stateHook = nextHook();
  nextHook();
  const isPending = stateHook !== null ? stateHook.memoizedState : false;
  hookLog.push({
    displayName: null,
    primitive: 'Transition',
    stackError: new Error(),
    value: isPending,
    debugInfo: null,
    dispatcherHookName: 'Transition'
  });
  return [isPending, () => {}];
}
function useDeferredValue(value, initialValue) {
  const hook = nextHook();
  const prevValue = hook !== null ? hook.memoizedState : value;
  hookLog.push({
    displayName: null,
    primitive: 'DeferredValue',
    stackError: new Error(),
    value: prevValue,
    debugInfo: null,
    dispatcherHookName: 'DeferredValue'
  });
  return prevValue;
}
function useId() {
  const hook = nextHook();
  const id = hook !== null ? hook.memoizedState : '';
  hookLog.push({
    displayName: null,
    primitive: 'Id',
    stackError: new Error(),
    value: id,
    debugInfo: null,
    dispatcherHookName: 'Id'
  });
  return id;
}
function useMemoCache(size) {
  const fiber = currentFiber;
  if (fiber == null) {
    return [];
  }
  const memoCache = fiber.updateQueue != null ? fiber.updateQueue.memoCache : null;
  if (memoCache == null) {
    return [];
  }
  let data = memoCache.data[memoCache.index];
  if (data === undefined) {
    data = memoCache.data[memoCache.index] = new Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = REACT_MEMO_CACHE_SENTINEL;
    }
  }
  memoCache.index++;
  return data;
}
function useOptimistic(passthrough, reducer) {
  const hook = nextHook();
  let state;
  if (hook !== null) {
    state = hook.memoizedState;
  } else {
    state = passthrough;
  }
  hookLog.push({
    displayName: null,
    primitive: 'Optimistic',
    stackError: new Error(),
    value: state,
    debugInfo: null,
    dispatcherHookName: 'Optimistic'
  });
  return [state, action => {}];
}
function useFormState(action, initialState, permalink) {
  const hook = nextHook();
  nextHook();
  nextHook();
  const stackError = new Error();
  let value;
  let debugInfo = null;
  let error = null;
  if (hook !== null) {
    const actionResult = hook.memoizedState;
    if (typeof actionResult === 'object' && actionResult !== null && typeof actionResult.then === 'function') {
      const thenable = actionResult;
      switch (thenable.status) {
        case 'fulfilled':
          {
            value = thenable.value;
            debugInfo = thenable._debugInfo === undefined ? null : thenable._debugInfo;
            break;
          }
        case 'rejected':
          {
            const rejectedError = thenable.reason;
            error = rejectedError;
            break;
          }
        default:
          error = SuspenseException;
          debugInfo = thenable._debugInfo === undefined ? null : thenable._debugInfo;
          value = thenable;
      }
    } else {
      value = actionResult;
    }
  } else {
    value = initialState;
  }
  hookLog.push({
    displayName: null,
    primitive: 'FormState',
    stackError: stackError,
    value: value,
    debugInfo: debugInfo,
    dispatcherHookName: 'FormState'
  });
  if (error !== null) {
    throw error;
  }
  const state = value;
  return [state, payload => {}, false];
}
function useActionState(action, initialState, permalink) {
  const hook = nextHook();
  nextHook();
  nextHook();
  const stackError = new Error();
  let value;
  let debugInfo = null;
  let error = null;
  if (hook !== null) {
    const actionResult = hook.memoizedState;
    if (typeof actionResult === 'object' && actionResult !== null && typeof actionResult.then === 'function') {
      const thenable = actionResult;
      switch (thenable.status) {
        case 'fulfilled':
          {
            value = thenable.value;
            debugInfo = thenable._debugInfo === undefined ? null : thenable._debugInfo;
            break;
          }
        case 'rejected':
          {
            const rejectedError = thenable.reason;
            error = rejectedError;
            break;
          }
        default:
          error = SuspenseException;
          debugInfo = thenable._debugInfo === undefined ? null : thenable._debugInfo;
          value = thenable;
      }
    } else {
      value = actionResult;
    }
  } else {
    value = initialState;
  }
  hookLog.push({
    displayName: null,
    primitive: 'ActionState',
    stackError: stackError,
    value: value,
    debugInfo: debugInfo,
    dispatcherHookName: 'ActionState'
  });
  if (error !== null) {
    throw error;
  }
  const state = value;
  return [state, payload => {}, false];
}
function useHostTransitionStatus() {
  const status = readContext({
    _currentValue: null
  });
  hookLog.push({
    displayName: null,
    primitive: 'HostTransitionStatus',
    stackError: new Error(),
    value: status,
    debugInfo: null,
    dispatcherHookName: 'HostTransitionStatus'
  });
  return status;
}
function useEffectEvent(callback) {
  nextHook();
  hookLog.push({
    displayName: null,
    primitive: 'EffectEvent',
    stackError: new Error(),
    value: callback,
    debugInfo: null,
    dispatcherHookName: 'EffectEvent'
  });
  return callback;
}
const Dispatcher = {
  readContext,
  use,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useInsertionEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useDebugValue,
  useDeferredValue,
  useTransition,
  useSyncExternalStore,
  useId,
  useHostTransitionStatus,
  useFormState,
  useActionState,
  useOptimistic,
  useMemoCache,
  useCacheRefresh,
  useEffectEvent
};
const DispatcherProxyHandler = {
  get(target, prop) {
    if (target.hasOwnProperty(prop)) {
      return target[prop];
    }
    const error = new Error('Missing method in Dispatcher: ' + prop);
    error.name = 'ReactDebugToolsUnsupportedHookError';
    throw error;
  }
};
const DispatcherProxy = typeof Proxy === 'undefined' ? Dispatcher : new Proxy(Dispatcher, DispatcherProxyHandler);
let mostLikelyAncestorIndex = 0;
function findSharedIndex(hookStack, rootStack, rootIndex) {
  const source = rootStack[rootIndex].source;
  hookSearch: for (let i = 0; i < hookStack.length; i++) {
    if (hookStack[i].source === source) {
      for (let a = rootIndex + 1, b = i + 1; a < rootStack.length && b < hookStack.length; a++, b++) {
        if (hookStack[b].source !== rootStack[a].source) {
          continue hookSearch;
        }
      }
      return i;
    }
  }
  return -1;
}
function findCommonAncestorIndex(rootStack, hookStack) {
  let rootIndex = findSharedIndex(hookStack, rootStack, mostLikelyAncestorIndex);
  if (rootIndex !== -1) {
    return rootIndex;
  }
  for (let i = 0; i < rootStack.length && i < 5; i++) {
    rootIndex = findSharedIndex(hookStack, rootStack, i);
    if (rootIndex !== -1) {
      mostLikelyAncestorIndex = i;
      return rootIndex;
    }
  }
  return -1;
}
function isReactWrapper(functionName, wrapperName) {
  const hookName = parseHookName(functionName);
  if (wrapperName === 'HostTransitionStatus') {
    return hookName === wrapperName || hookName === 'FormStatus';
  }
  return hookName === wrapperName;
}
function findPrimitiveIndex(hookStack, hook) {
  const stackCache = getPrimitiveStackCache();
  const primitiveStack = stackCache.get(hook.primitive);
  if (primitiveStack === undefined) {
    return -1;
  }
  for (let i = 0; i < primitiveStack.length && i < hookStack.length; i++) {
    if (primitiveStack[i].source !== hookStack[i].source) {
      if (i < hookStack.length - 1 && isReactWrapper(hookStack[i].functionName, hook.dispatcherHookName)) {
        i++;
      }
      if (i < hookStack.length - 1 && isReactWrapper(hookStack[i].functionName, hook.dispatcherHookName)) {
        i++;
      }
      return i;
    }
  }
  return -1;
}
function parseTrimmedStack(rootStack, hook) {
  const hookStack = error_stack_parser_default().parse(hook.stackError);
  const rootIndex = findCommonAncestorIndex(rootStack, hookStack);
  const primitiveIndex = findPrimitiveIndex(hookStack, hook);
  if (rootIndex === -1 || primitiveIndex === -1 || rootIndex - primitiveIndex < 2) {
    if (primitiveIndex === -1) {
      return [null, null];
    } else {
      return [hookStack[primitiveIndex - 1], null];
    }
  }
  return [hookStack[primitiveIndex - 1], hookStack.slice(primitiveIndex, rootIndex - 1)];
}
function parseHookName(functionName) {
  if (!functionName) {
    return '';
  }
  let startIndex = functionName.lastIndexOf('[as ');
  if (startIndex !== -1) {
    return parseHookName(functionName.slice(startIndex + '[as '.length, -1));
  }
  startIndex = functionName.lastIndexOf('.');
  if (startIndex === -1) {
    startIndex = 0;
  } else {
    startIndex += 1;
  }
  if (functionName.slice(startIndex).startsWith('unstable_')) {
    startIndex += 'unstable_'.length;
  }
  if (functionName.slice(startIndex).startsWith('experimental_')) {
    startIndex += 'experimental_'.length;
  }
  if (functionName.slice(startIndex, startIndex + 3) === 'use') {
    if (functionName.length - startIndex === 3) {
      return 'Use';
    }
    startIndex += 3;
  }
  return functionName.slice(startIndex);
}
function buildTree(rootStack, readHookLog) {
  const rootChildren = [];
  let prevStack = null;
  let levelChildren = rootChildren;
  let nativeHookID = 0;
  const stackOfChildren = [];
  for (let i = 0; i < readHookLog.length; i++) {
    const hook = readHookLog[i];
    const parseResult = parseTrimmedStack(rootStack, hook);
    const primitiveFrame = parseResult[0];
    const stack = parseResult[1];
    let displayName = hook.displayName;
    if (displayName === null && primitiveFrame !== null) {
      displayName = parseHookName(primitiveFrame.functionName) || parseHookName(hook.dispatcherHookName);
    }
    if (stack !== null) {
      let commonSteps = 0;
      if (prevStack !== null) {
        while (commonSteps < stack.length && commonSteps < prevStack.length) {
          const stackSource = stack[stack.length - commonSteps - 1].source;
          const prevSource = prevStack[prevStack.length - commonSteps - 1].source;
          if (stackSource !== prevSource) {
            break;
          }
          commonSteps++;
        }
        for (let j = prevStack.length - 1; j > commonSteps; j--) {
          levelChildren = stackOfChildren.pop();
        }
      }
      for (let j = stack.length - commonSteps - 1; j >= 1; j--) {
        const children = [];
        const stackFrame = stack[j];
        const levelChild = {
          id: null,
          isStateEditable: false,
          name: parseHookName(stack[j - 1].functionName),
          value: undefined,
          subHooks: children,
          debugInfo: null,
          hookSource: {
            lineNumber: stackFrame.lineNumber === undefined ? null : stackFrame.lineNumber,
            columnNumber: stackFrame.columnNumber === undefined ? null : stackFrame.columnNumber,
            functionName: stackFrame.functionName === undefined ? null : stackFrame.functionName,
            fileName: stackFrame.fileName === undefined ? null : stackFrame.fileName
          }
        };
        levelChildren.push(levelChild);
        stackOfChildren.push(levelChildren);
        levelChildren = children;
      }
      prevStack = stack;
    }
    const {
      primitive,
      debugInfo
    } = hook;
    const id = primitive === 'Context' || primitive === 'Context (use)' || primitive === 'DebugValue' || primitive === 'Promise' || primitive === 'Unresolved' || primitive === 'HostTransitionStatus' ? null : nativeHookID++;
    const isStateEditable = primitive === 'Reducer' || primitive === 'State';
    const name = displayName || primitive;
    const levelChild = {
      id,
      isStateEditable,
      name,
      value: hook.value,
      subHooks: [],
      debugInfo: debugInfo,
      hookSource: null
    };
    const hookSource = {
      lineNumber: null,
      functionName: null,
      fileName: null,
      columnNumber: null
    };
    if (stack && stack.length >= 1) {
      const stackFrame = stack[0];
      hookSource.lineNumber = stackFrame.lineNumber === undefined ? null : stackFrame.lineNumber;
      hookSource.functionName = stackFrame.functionName === undefined ? null : stackFrame.functionName;
      hookSource.fileName = stackFrame.fileName === undefined ? null : stackFrame.fileName;
      hookSource.columnNumber = stackFrame.columnNumber === undefined ? null : stackFrame.columnNumber;
    }
    levelChild.hookSource = hookSource;
    levelChildren.push(levelChild);
  }
  processDebugValues(rootChildren, null);
  return rootChildren;
}
function processDebugValues(hooksTree, parentHooksNode) {
  const debugValueHooksNodes = [];
  for (let i = 0; i < hooksTree.length; i++) {
    const hooksNode = hooksTree[i];
    if (hooksNode.name === 'DebugValue' && hooksNode.subHooks.length === 0) {
      hooksTree.splice(i, 1);
      i--;
      debugValueHooksNodes.push(hooksNode);
    } else {
      processDebugValues(hooksNode.subHooks, hooksNode);
    }
  }
  if (parentHooksNode !== null) {
    if (debugValueHooksNodes.length === 1) {
      parentHooksNode.value = debugValueHooksNodes[0].value;
    } else if (debugValueHooksNodes.length > 1) {
      parentHooksNode.value = debugValueHooksNodes.map(({
        value
      }) => value);
    }
  }
}
function handleRenderFunctionError(error) {
  if (error === SuspenseException) {
    return;
  }
  if (error instanceof Error && error.name === 'ReactDebugToolsUnsupportedHookError') {
    throw error;
  }
  const wrapperError = new Error('Error rendering inspected component', {
    cause: error
  });
  wrapperError.name = 'ReactDebugToolsRenderError';
  wrapperError.cause = error;
  throw wrapperError;
}
function inspectHooks(renderFunction, props, currentDispatcher) {
  if (currentDispatcher == null) {
    currentDispatcher = shared_ReactSharedInternals;
  }
  const previousDispatcher = currentDispatcher.H;
  currentDispatcher.H = DispatcherProxy;
  let readHookLog;
  let ancestorStackError;
  try {
    ancestorStackError = new Error();
    renderFunction(props);
  } catch (error) {
    handleRenderFunctionError(error);
  } finally {
    readHookLog = hookLog;
    hookLog = [];
    currentDispatcher.H = previousDispatcher;
  }
  const rootStack = ancestorStackError === undefined ? [] : error_stack_parser_default().parse(ancestorStackError);
  return buildTree(rootStack, readHookLog);
}
function setupContexts(contextMap, fiber) {
  let current = fiber;
  while (current) {
    if (current.tag === ContextProvider) {
      let context = current.type;
      if (context._context !== undefined) {
        context = context._context;
      }
      if (!contextMap.has(context)) {
        contextMap.set(context, context._currentValue);
        context._currentValue = current.memoizedProps.value;
      }
    }
    current = current.return;
  }
}
function restoreContexts(contextMap) {
  contextMap.forEach((value, context) => context._currentValue = value);
}
function inspectHooksOfForwardRef(renderFunction, props, ref, currentDispatcher) {
  const previousDispatcher = currentDispatcher.H;
  let readHookLog;
  currentDispatcher.H = DispatcherProxy;
  let ancestorStackError;
  try {
    ancestorStackError = new Error();
    renderFunction(props, ref);
  } catch (error) {
    handleRenderFunctionError(error);
  } finally {
    readHookLog = hookLog;
    hookLog = [];
    currentDispatcher.H = previousDispatcher;
  }
  const rootStack = ancestorStackError === undefined ? [] : error_stack_parser_default().parse(ancestorStackError);
  return buildTree(rootStack, readHookLog);
}
function resolveDefaultProps(Component, baseProps) {
  if (Component && Component.defaultProps) {
    const props = shared_assign({}, baseProps);
    const defaultProps = Component.defaultProps;
    for (const propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
    return props;
  }
  return baseProps;
}
function inspectHooksOfFiber(fiber, currentDispatcher) {
  if (currentDispatcher == null) {
    currentDispatcher = shared_ReactSharedInternals;
  }
  if (fiber.tag !== FunctionComponent && fiber.tag !== SimpleMemoComponent && fiber.tag !== ForwardRef) {
    throw new Error('Unknown Fiber. Needs to be a function component to inspect hooks.');
  }
  getPrimitiveStackCache();
  currentHook = fiber.memoizedState;
  currentFiber = fiber;
  const thenableState = fiber.dependencies && fiber.dependencies._debugThenableState;
  const usedThenables = thenableState ? thenableState.thenables || thenableState : null;
  currentThenableState = Array.isArray(usedThenables) ? usedThenables : null;
  currentThenableIndex = 0;
  if (shared_hasOwnProperty.call(currentFiber, 'dependencies')) {
    const dependencies = currentFiber.dependencies;
    currentContextDependency = dependencies !== null ? dependencies.firstContext : null;
  } else if (shared_hasOwnProperty.call(currentFiber, 'dependencies_old')) {
    const dependencies = currentFiber.dependencies_old;
    currentContextDependency = dependencies !== null ? dependencies.firstContext : null;
  } else if (shared_hasOwnProperty.call(currentFiber, 'dependencies_new')) {
    const dependencies = currentFiber.dependencies_new;
    currentContextDependency = dependencies !== null ? dependencies.firstContext : null;
  } else if (shared_hasOwnProperty.call(currentFiber, 'contextDependencies')) {
    const contextDependencies = currentFiber.contextDependencies;
    currentContextDependency = contextDependencies !== null ? contextDependencies.first : null;
  } else {
    throw new Error('Unsupported React version. This is a bug in React Debug Tools.');
  }
  const type = fiber.type;
  let props = fiber.memoizedProps;
  if (type !== fiber.elementType) {
    props = resolveDefaultProps(type, props);
  }
  const contextMap = new Map();
  try {
    if (currentContextDependency !== null && !shared_hasOwnProperty.call(currentContextDependency, 'memoizedValue')) {
      setupContexts(contextMap, fiber);
    }
    if (fiber.tag === ForwardRef) {
      return inspectHooksOfForwardRef(type.render, props, fiber.ref, currentDispatcher);
    }
    return inspectHooks(type, props, currentDispatcher);
  } finally {
    currentFiber = null;
    currentHook = null;
    currentContextDependency = null;
    currentThenableState = null;
    currentThenableIndex = 0;
    restoreContexts(contextMap);
  }
}
;// CONCATENATED MODULE: ../react-debug-tools/src/ReactDebugTools.js


;// CONCATENATED MODULE: ../react-debug-tools/index.js

;// CONCATENATED MODULE: ../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberInspection.js
const DevToolsFiberInspection_toString = Object.prototype.toString;
function isError(object) {
  return DevToolsFiberInspection_toString.call(object) === '[object Error]';
}
function getFiberFlags(fiber) {
  return fiber.flags !== undefined ? fiber.flags : fiber.effectTag;
}
function rootSupportsProfiling(root) {
  if (root.memoizedInteractions != null) {
    return true;
  } else if (root.current != null && root.current.hasOwnProperty('treeBaseDuration')) {
    return true;
  } else {
    return false;
  }
}
function isErrorBoundary(workTagMap, fiber) {
  const {
    tag,
    type
  } = fiber;
  switch (tag) {
    case workTagMap.ClassComponent:
    case workTagMap.IncompleteClassComponent:
      const instance = fiber.stateNode;
      return typeof type.getDerivedStateFromError === 'function' || instance !== null && typeof instance.componentDidCatch === 'function';
    default:
      return false;
  }
}
function getSecondaryEnvironmentName(debugInfo, index) {
  if (debugInfo != null) {
    const componentInfo = debugInfo[index];
    for (let i = index + 1; i < debugInfo.length; i++) {
      const debugEntry = debugInfo[i];
      if (typeof debugEntry.env === 'string') {
        return componentInfo.env !== debugEntry.env ? debugEntry.env : null;
      }
    }
  }
  return null;
}
function areEqualRects(a, b) {
  if (a === null) {
    return b === null;
  }
  if (b === null) {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const aRect = a[i];
    const bRect = b[i];
    if (aRect.x !== bRect.x || aRect.y !== bRect.y || aRect.width !== bRect.width || aRect.height !== bRect.height) {
      return false;
    }
  }
  return true;
}
;// CONCATENATED MODULE: ../shared/objectIs.js
function is(x, y) {
  return x === y && (x !== 0 || 1 / x === 1 / y) || x !== x && y !== y;
}
const objectIs = typeof Object.is === 'function' ? Object.is : is;
/* harmony default export */ const shared_objectIs = (objectIs);
;// CONCATENATED MODULE: ../react-devtools-shared/src/backend/fiber/shared/DevToolsFiberChangeDetection.js


function getContextChanged(prevFiber, nextFiber) {
  let prevContext = prevFiber.dependencies && prevFiber.dependencies.firstContext;
  let nextContext = nextFiber.dependencies && nextFiber.dependencies.firstContext;
  while (prevContext && nextContext) {
    if (prevContext.context !== nextContext.context) {
      return false;
    }
    if (!shared_objectIs(prevContext.memoizedValue, nextContext.memoizedValue)) {
      return true;
    }
    prevContext = prevContext.next;
    nextContext = nextContext.next;
  }
  return false;
}
function didStatefulHookChange(prev, next) {
  const isStatefulHook = prev.isStateEditable === true || prev.name === 'SyncExternalStore' || prev.name === 'Transition' || prev.name === 'ActionState' || prev.name === 'FormState';
  if (isStatefulHook) {
    return prev.value !== next.value;
  }
  return false;
}
function getChangedHooksIndices(prevHooks, nextHooks) {
  if (prevHooks == null || nextHooks == null) {
    return null;
  }
  const indices = [];
  let index = 0;
  function traverse(prevTree, nextTree) {
    for (let i = 0; i < prevTree.length; i++) {
      const prevHook = prevTree[i];
      const nextHook = nextTree[i];
      if (prevHook.subHooks.length > 0 && nextHook.subHooks.length > 0) {
        traverse(prevHook.subHooks, nextHook.subHooks);
        continue;
      }
      if (didStatefulHookChange(prevHook, nextHook)) {
        indices.push(index);
      }
      index++;
    }
  }
  traverse(prevHooks, nextHooks);
  return indices;
}
function getChangedKeys(prev, next) {
  if (prev == null || next == null) {
    return null;
  }
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changedKeys = [];
  for (const key of keys) {
    if (prev[key] !== next[key]) {
      changedKeys.push(key);
    }
  }
  return changedKeys;
}
function didFiberRender(workTagMap, prevFiber, nextFiber) {
  switch (nextFiber.tag) {
    case workTagMap.ClassComponent:
    case workTagMap.FunctionComponent:
    case workTagMap.ContextConsumer:
    case workTagMap.MemoComponent:
    case workTagMap.SimpleMemoComponent:
    case workTagMap.ForwardRef:
      const PerformedWork = 0b000000000000000000000000001;
      return (getFiberFlags(nextFiber) & PerformedWork) === PerformedWork;
    default:
      return prevFiber.memoizedProps !== nextFiber.memoizedProps || prevFiber.memoizedState !== nextFiber.memoizedState || prevFiber.ref !== nextFiber.ref;
  }
}
;// CONCATENATED MODULE: ../shared/ReactFeatureFlags.js
const disableSchedulerTimeoutInWorkLoop = false;
const enableSuspenseCallback = false;
const enableScopeAPI = false;
const enableCreateEventHandleAPI = false;
const enableLegacyFBSupport = false;
const enableYieldingBeforePassive = false;
const enableThrottledScheduling = false;
const enableLegacyCache = (/* unused pure expression or super */ null && (true));
const enableAsyncIterableChildren = (/* unused pure expression or super */ null && (true));
const enableTaint = (/* unused pure expression or super */ null && (true));
const enableViewTransition = true;
const enableViewTransitionForPersistenceMode = false;
const enableGestureTransition = (/* unused pure expression or super */ null && (true));
const enableScrollEndPolyfill = (/* unused pure expression or super */ null && (true));
const enableSuspenseyImages = false;
const enableFizzBlockingRender = (/* unused pure expression or super */ null && (true));
const enableSrcObject = (/* unused pure expression or super */ null && (true));
const enableHydrationChangeEvent = (/* unused pure expression or super */ null && (true));
const enableDefaultTransitionIndicator = (/* unused pure expression or super */ null && (true));
const enableOptimisticKey = (/* unused pure expression or super */ null && (true));
const enableObjectFiber = false;
const enableTransitionTracing = false;
const enableLegacyHidden = false;
const enableSuspenseAvoidThisFallback = false;
const enableCPUSuspense = (/* unused pure expression or super */ null && (true));
const enableNoCloningMemoCache = false;
const enableFizzExternalRuntime = (/* unused pure expression or super */ null && (true));
const alwaysThrottleRetries = true;
const enableEffectEventMutationPhase = false;
const passChildrenWhenCloningPersistedNodes = false;
const enableEagerAlternateStateNodeCleanup = true;
const enableRetryLaneExpiration = false;
const retryLaneExpirationMs = 5000;
const syncLaneExpirationMs = 250;
const transitionLaneExpirationMs = 5000;
const enableInfiniteRenderLoopDetection = false;
const enableFragmentRefs = true;
const enableFragmentRefsScrollIntoView = true;
const enableFragmentRefsInstanceHandles = true;
const enableFragmentRefsTextNodes = true;
const enableInternalInstanceMap = false;
const disableLegacyContext = true;
const disableLegacyContextForFunctionComponents = true;
const enableMoveBefore = false;
const disableClientCache = true;
const enableReactTestRendererWarning = true;
const disableLegacyMode = true;
const disableCommentsAsDOMContainers = true;
const enableTrustedTypesIntegration = true;
const disableInputAttributeSyncing = false;
const disableTextareaChildren = false;
const enableParallelTransitions = false;
const enableProfilerTimer = (/* unused pure expression or super */ null && (false));
const enableComponentPerformanceTrack = true;
const enablePerformanceIssueReporting = false;
const enableSchedulingProfiler = !enableComponentPerformanceTrack && false;
const enableProfilerCommitHooks = (/* unused pure expression or super */ null && (false));
const enableProfilerNestedUpdatePhase = (/* unused pure expression or super */ null && (false));
const enableAsyncDebugInfo = true;
const enableUpdaterTracking = (/* unused pure expression or super */ null && (false));
const ownerStackLimit = 1e4;
const eprh_enableUseKeyedStateCompilerLint = false;
const eprh_enableVerboseNoSetStateInEffectCompilerLint = false;
const eprh_enableExhaustiveEffectDependenciesCompilerLint = 'off';
;// CONCATENATED MODULE: ../shared/getComponentNameFromType.js


function getWrappedName(outerType, innerType, wrapperName) {
  const displayName = outerType.displayName;
  if (displayName) {
    return displayName;
  }
  const functionName = innerType.displayName || innerType.name || '';
  return functionName !== '' ? `${wrapperName}(${functionName})` : wrapperName;
}
function getContextName(type) {
  return type.displayName || 'Context';
}
const REACT_CLIENT_REFERENCE = Symbol.for('react.client.reference');
function getComponentNameFromType(type) {
  if (type == null) {
    return null;
  }
  if (typeof type === 'function') {
    if (type.$$typeof === REACT_CLIENT_REFERENCE) {
      return null;
    }
    return type.displayName || type.name || null;
  }
  if (typeof type === 'string') {
    return type;
  }
  switch (type) {
    case REACT_FRAGMENT_TYPE:
      return 'Fragment';
    case REACT_PROFILER_TYPE:
      return 'Profiler';
    case REACT_STRICT_MODE_TYPE:
      return 'StrictMode';
    case REACT_SUSPENSE_TYPE:
      return 'Suspense';
    case REACT_SUSPENSE_LIST_TYPE:
      return 'SuspenseList';
    case REACT_ACTIVITY_TYPE:
      return 'Activity';
    case REACT_VIEW_TRANSITION_TYPE:
      if (enableViewTransition) {
        return 'ViewTransition';
      }
    case REACT_TRACING_MARKER_TYPE:
      if (enableTransitionTracing) {
        return 'TracingMarker';
      }
  }
  if (typeof type === 'object') {
    if (false) {}
    switch (type.$$typeof) {
      case REACT_PORTAL_TYPE:
        return 'Portal';
      case REACT_CONTEXT_TYPE:
        const context = type;
        return getContextName(context);
      case REACT_CONSUMER_TYPE:
        const consumer = type;
        return getContextName(consumer._context) + '.Consumer';
      case REACT_FORWARD_REF_TYPE:
        return getWrappedName(type, type.render, 'ForwardRef');
      case REACT_MEMO_TYPE:
        const outerName = type.displayName || null;
        if (outerName !== null) {
          return outerName;
        }
        return getComponentNameFromType(type.type) || 'Memo';
      case REACT_LAZY_TYPE:
        {
          const lazyComponent = type;
          const payload = lazyComponent._payload;
          const init = lazyComponent._init;
          try {
            return getComponentNameFromType(init(payload));
          } catch (x) {
            return null;
          }
        }
    }
  }
  return null;
}
;// CONCATENATED MODULE: ./src/onCommitFiber.js




const IndeterminateComponent = 2;
const ReactTypeOfWork = {
  ClassComponent: ClassComponent,
  ContextConsumer: ContextConsumer,
  ForwardRef: ForwardRef,
  FunctionComponent: FunctionComponent,
  MemoComponent: MemoComponent,
  SimpleMemoComponent: SimpleMemoComponent
};
function getDisplayNameForFiber(fiber) {
  return getComponentNameFromType(fiber.type);
}
function getHooksTree(fiber, currentDispatcherRef) {
  try {
    return inspectHooksOfFiber(fiber, currentDispatcherRef);
  } catch {
    return null;
  }
}
function getChangedHooks(prevHooks, nextHooks) {
  if (prevHooks == null || nextHooks == null) {
    return null;
  }
  const changedHooks = [];
  function traverse(prevTree, nextTree, customHookPath) {
    const customHookCounts = new Map();
    const length = Math.min(prevTree.length, nextTree.length);
    for (let index = 0; index < length; index++) {
      const prevHook = prevTree[index];
      const nextHook = nextTree[index];
      let nextCustomHookPath = customHookPath;
      if (nextHook.id === null && nextHook.subHooks.length > 0) {
        const customHookCount = customHookCounts.get(nextHook.name) ?? 0;
        customHookCounts.set(nextHook.name, customHookCount + 1);
        nextCustomHookPath = [...customHookPath, `${nextHook.name}(${customHookCount})`];
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
          next: nextHook.value
        });
      }
    }
  }
  traverse(prevHooks, nextHooks, []);
  return changedHooks;
}
function getChangeDescription(prevFiber, nextFiber, currentDispatcherRef) {
  switch (nextFiber.tag) {
    case ClassComponent:
      if (prevFiber === null) {
        return {
          context: null,
          didHooksChange: false,
          isFirstMount: true,
          props: null,
          state: null
        };
      }
      return {
        context: getContextChanged(prevFiber, nextFiber),
        didHooksChange: false,
        isFirstMount: false,
        props: getChangedKeys(prevFiber.memoizedProps, nextFiber.memoizedProps),
        state: getChangedKeys(prevFiber.memoizedState, nextFiber.memoizedState)
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
          state: null
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
        state: null
      };
    default:
      return null;
  }
}
function collectFiberChanges(fiber, changes, currentDispatcherRef) {
  if (fiber === null) {
    return;
  }
  const prevFiber = fiber.alternate;
  if (prevFiber === null || didFiberRender(ReactTypeOfWork, prevFiber, fiber)) {
    const changeDescription = getChangeDescription(prevFiber, fiber, currentDispatcherRef);
    if (changeDescription !== null) {
      changes.push({
        changeDescription,
        displayName: getDisplayNameForFiber(fiber),
        fiber,
        prevFiber
      });
    }
  }
  collectFiberChanges(fiber.child, changes, currentDispatcherRef);
  collectFiberChanges(fiber.sibling, changes, currentDispatcherRef);
}
function onCommitFiber(root, currentDispatcherRef) {
  if (root.current == null || root.current.child == null) {
    return [];
  }
  const changes = [];
  collectFiberChanges(root.current, changes, currentDispatcherRef);
  return changes;
}
;// CONCATENATED MODULE: ./index.js
function installHook(target, componentFiltersOrComponentFiltersPromise, maybeSettingsOrSettingsPromise, shouldStartProfilingNow, profilingSettings) {
  if (typeof target !== 'object' || target == null) {
    throw new Error('installHook(target) requires a global object target.');
  }
  if (target !== globalThis) {
    throw new Error('react-devtools-custom installHook currently only supports globalThis/window as the target.');
  }
  const backend = __webpack_require__(910);
  backend.initialize(maybeSettingsOrSettingsPromise, shouldStartProfilingNow, profilingSettings, componentFiltersOrComponentFiltersPromise);
  return target.__REACT_DEVTOOLS_GLOBAL_HOOK__ ?? null;
}

})();

module.exports = __webpack_exports__;
/******/ })()
;
//# sourceMappingURL=index.js.map