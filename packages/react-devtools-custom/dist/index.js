/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 730:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


const Yallist = __webpack_require__(695);
const MAX = Symbol('max');
const LENGTH = Symbol('length');
const LENGTH_CALCULATOR = Symbol('lengthCalculator');
const ALLOW_STALE = Symbol('allowStale');
const MAX_AGE = Symbol('maxAge');
const DISPOSE = Symbol('dispose');
const NO_DISPOSE_ON_SET = Symbol('noDisposeOnSet');
const LRU_LIST = Symbol('lruList');
const CACHE = Symbol('cache');
const UPDATE_AGE_ON_GET = Symbol('updateAgeOnGet');
const naiveLength = () => 1;
class LRUCache {
  constructor(options) {
    if (typeof options === 'number') options = {
      max: options
    };
    if (!options) options = {};
    if (options.max && (typeof options.max !== 'number' || options.max < 0)) throw new TypeError('max must be a non-negative number');
    const max = this[MAX] = options.max || Infinity;
    const lc = options.length || naiveLength;
    this[LENGTH_CALCULATOR] = typeof lc !== 'function' ? naiveLength : lc;
    this[ALLOW_STALE] = options.stale || false;
    if (options.maxAge && typeof options.maxAge !== 'number') throw new TypeError('maxAge must be a number');
    this[MAX_AGE] = options.maxAge || 0;
    this[DISPOSE] = options.dispose;
    this[NO_DISPOSE_ON_SET] = options.noDisposeOnSet || false;
    this[UPDATE_AGE_ON_GET] = options.updateAgeOnGet || false;
    this.reset();
  }
  set max(mL) {
    if (typeof mL !== 'number' || mL < 0) throw new TypeError('max must be a non-negative number');
    this[MAX] = mL || Infinity;
    trim(this);
  }
  get max() {
    return this[MAX];
  }
  set allowStale(allowStale) {
    this[ALLOW_STALE] = !!allowStale;
  }
  get allowStale() {
    return this[ALLOW_STALE];
  }
  set maxAge(mA) {
    if (typeof mA !== 'number') throw new TypeError('maxAge must be a non-negative number');
    this[MAX_AGE] = mA;
    trim(this);
  }
  get maxAge() {
    return this[MAX_AGE];
  }
  set lengthCalculator(lC) {
    if (typeof lC !== 'function') lC = naiveLength;
    if (lC !== this[LENGTH_CALCULATOR]) {
      this[LENGTH_CALCULATOR] = lC;
      this[LENGTH] = 0;
      this[LRU_LIST].forEach(hit => {
        hit.length = this[LENGTH_CALCULATOR](hit.value, hit.key);
        this[LENGTH] += hit.length;
      });
    }
    trim(this);
  }
  get lengthCalculator() {
    return this[LENGTH_CALCULATOR];
  }
  get length() {
    return this[LENGTH];
  }
  get itemCount() {
    return this[LRU_LIST].length;
  }
  rforEach(fn, thisp) {
    thisp = thisp || this;
    for (let walker = this[LRU_LIST].tail; walker !== null;) {
      const prev = walker.prev;
      forEachStep(this, fn, walker, thisp);
      walker = prev;
    }
  }
  forEach(fn, thisp) {
    thisp = thisp || this;
    for (let walker = this[LRU_LIST].head; walker !== null;) {
      const next = walker.next;
      forEachStep(this, fn, walker, thisp);
      walker = next;
    }
  }
  keys() {
    return this[LRU_LIST].toArray().map(k => k.key);
  }
  values() {
    return this[LRU_LIST].toArray().map(k => k.value);
  }
  reset() {
    if (this[DISPOSE] && this[LRU_LIST] && this[LRU_LIST].length) {
      this[LRU_LIST].forEach(hit => this[DISPOSE](hit.key, hit.value));
    }
    this[CACHE] = new Map();
    this[LRU_LIST] = new Yallist();
    this[LENGTH] = 0;
  }
  dump() {
    return this[LRU_LIST].map(hit => isStale(this, hit) ? false : {
      k: hit.key,
      v: hit.value,
      e: hit.now + (hit.maxAge || 0)
    }).toArray().filter(h => h);
  }
  dumpLru() {
    return this[LRU_LIST];
  }
  set(key, value, maxAge) {
    maxAge = maxAge || this[MAX_AGE];
    if (maxAge && typeof maxAge !== 'number') throw new TypeError('maxAge must be a number');
    const now = maxAge ? Date.now() : 0;
    const len = this[LENGTH_CALCULATOR](value, key);
    if (this[CACHE].has(key)) {
      if (len > this[MAX]) {
        del(this, this[CACHE].get(key));
        return false;
      }
      const node = this[CACHE].get(key);
      const item = node.value;
      if (this[DISPOSE]) {
        if (!this[NO_DISPOSE_ON_SET]) this[DISPOSE](key, item.value);
      }
      item.now = now;
      item.maxAge = maxAge;
      item.value = value;
      this[LENGTH] += len - item.length;
      item.length = len;
      this.get(key);
      trim(this);
      return true;
    }
    const hit = new Entry(key, value, len, now, maxAge);
    if (hit.length > this[MAX]) {
      if (this[DISPOSE]) this[DISPOSE](key, value);
      return false;
    }
    this[LENGTH] += hit.length;
    this[LRU_LIST].unshift(hit);
    this[CACHE].set(key, this[LRU_LIST].head);
    trim(this);
    return true;
  }
  has(key) {
    if (!this[CACHE].has(key)) return false;
    const hit = this[CACHE].get(key).value;
    return !isStale(this, hit);
  }
  get(key) {
    return get(this, key, true);
  }
  peek(key) {
    return get(this, key, false);
  }
  pop() {
    const node = this[LRU_LIST].tail;
    if (!node) return null;
    del(this, node);
    return node.value;
  }
  del(key) {
    del(this, this[CACHE].get(key));
  }
  load(arr) {
    this.reset();
    const now = Date.now();
    for (let l = arr.length - 1; l >= 0; l--) {
      const hit = arr[l];
      const expiresAt = hit.e || 0;
      if (expiresAt === 0) this.set(hit.k, hit.v);else {
        const maxAge = expiresAt - now;
        if (maxAge > 0) {
          this.set(hit.k, hit.v, maxAge);
        }
      }
    }
  }
  prune() {
    this[CACHE].forEach((value, key) => get(this, key, false));
  }
}
const get = (self, key, doUse) => {
  const node = self[CACHE].get(key);
  if (node) {
    const hit = node.value;
    if (isStale(self, hit)) {
      del(self, node);
      if (!self[ALLOW_STALE]) return undefined;
    } else {
      if (doUse) {
        if (self[UPDATE_AGE_ON_GET]) node.value.now = Date.now();
        self[LRU_LIST].unshiftNode(node);
      }
    }
    return hit.value;
  }
};
const isStale = (self, hit) => {
  if (!hit || !hit.maxAge && !self[MAX_AGE]) return false;
  const diff = Date.now() - hit.now;
  return hit.maxAge ? diff > hit.maxAge : self[MAX_AGE] && diff > self[MAX_AGE];
};
const trim = self => {
  if (self[LENGTH] > self[MAX]) {
    for (let walker = self[LRU_LIST].tail; self[LENGTH] > self[MAX] && walker !== null;) {
      const prev = walker.prev;
      del(self, walker);
      walker = prev;
    }
  }
};
const del = (self, node) => {
  if (node) {
    const hit = node.value;
    if (self[DISPOSE]) self[DISPOSE](hit.key, hit.value);
    self[LENGTH] -= hit.length;
    self[CACHE].delete(hit.key);
    self[LRU_LIST].removeNode(node);
  }
};
class Entry {
  constructor(key, value, length, now, maxAge) {
    this.key = key;
    this.value = value;
    this.length = length;
    this.now = now;
    this.maxAge = maxAge || 0;
  }
}
const forEachStep = (self, fn, node, thisp) => {
  let hit = node.value;
  if (isStale(self, hit)) {
    del(self, node);
    if (!self[ALLOW_STALE]) hit = undefined;
  }
  if (hit) fn.call(thisp, hit.value, hit.key, self);
};
module.exports = LRUCache;

/***/ }),

/***/ 476:
/***/ ((module) => {

"use strict";


module.exports = function (Yallist) {
  Yallist.prototype[Symbol.iterator] = function* () {
    for (let walker = this.head; walker; walker = walker.next) {
      yield walker.value;
    }
  };
};

/***/ }),

/***/ 695:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";


module.exports = Yallist;
Yallist.Node = Node;
Yallist.create = Yallist;
function Yallist(list) {
  var self = this;
  if (!(self instanceof Yallist)) {
    self = new Yallist();
  }
  self.tail = null;
  self.head = null;
  self.length = 0;
  if (list && typeof list.forEach === 'function') {
    list.forEach(function (item) {
      self.push(item);
    });
  } else if (arguments.length > 0) {
    for (var i = 0, l = arguments.length; i < l; i++) {
      self.push(arguments[i]);
    }
  }
  return self;
}
Yallist.prototype.removeNode = function (node) {
  if (node.list !== this) {
    throw new Error('removing node which does not belong to this list');
  }
  var next = node.next;
  var prev = node.prev;
  if (next) {
    next.prev = prev;
  }
  if (prev) {
    prev.next = next;
  }
  if (node === this.head) {
    this.head = next;
  }
  if (node === this.tail) {
    this.tail = prev;
  }
  node.list.length--;
  node.next = null;
  node.prev = null;
  node.list = null;
  return next;
};
Yallist.prototype.unshiftNode = function (node) {
  if (node === this.head) {
    return;
  }
  if (node.list) {
    node.list.removeNode(node);
  }
  var head = this.head;
  node.list = this;
  node.next = head;
  if (head) {
    head.prev = node;
  }
  this.head = node;
  if (!this.tail) {
    this.tail = node;
  }
  this.length++;
};
Yallist.prototype.pushNode = function (node) {
  if (node === this.tail) {
    return;
  }
  if (node.list) {
    node.list.removeNode(node);
  }
  var tail = this.tail;
  node.list = this;
  node.prev = tail;
  if (tail) {
    tail.next = node;
  }
  this.tail = node;
  if (!this.head) {
    this.head = node;
  }
  this.length++;
};
Yallist.prototype.push = function () {
  for (var i = 0, l = arguments.length; i < l; i++) {
    push(this, arguments[i]);
  }
  return this.length;
};
Yallist.prototype.unshift = function () {
  for (var i = 0, l = arguments.length; i < l; i++) {
    unshift(this, arguments[i]);
  }
  return this.length;
};
Yallist.prototype.pop = function () {
  if (!this.tail) {
    return undefined;
  }
  var res = this.tail.value;
  this.tail = this.tail.prev;
  if (this.tail) {
    this.tail.next = null;
  } else {
    this.head = null;
  }
  this.length--;
  return res;
};
Yallist.prototype.shift = function () {
  if (!this.head) {
    return undefined;
  }
  var res = this.head.value;
  this.head = this.head.next;
  if (this.head) {
    this.head.prev = null;
  } else {
    this.tail = null;
  }
  this.length--;
  return res;
};
Yallist.prototype.forEach = function (fn, thisp) {
  thisp = thisp || this;
  for (var walker = this.head, i = 0; walker !== null; i++) {
    fn.call(thisp, walker.value, i, this);
    walker = walker.next;
  }
};
Yallist.prototype.forEachReverse = function (fn, thisp) {
  thisp = thisp || this;
  for (var walker = this.tail, i = this.length - 1; walker !== null; i--) {
    fn.call(thisp, walker.value, i, this);
    walker = walker.prev;
  }
};
Yallist.prototype.get = function (n) {
  for (var i = 0, walker = this.head; walker !== null && i < n; i++) {
    walker = walker.next;
  }
  if (i === n && walker !== null) {
    return walker.value;
  }
};
Yallist.prototype.getReverse = function (n) {
  for (var i = 0, walker = this.tail; walker !== null && i < n; i++) {
    walker = walker.prev;
  }
  if (i === n && walker !== null) {
    return walker.value;
  }
};
Yallist.prototype.map = function (fn, thisp) {
  thisp = thisp || this;
  var res = new Yallist();
  for (var walker = this.head; walker !== null;) {
    res.push(fn.call(thisp, walker.value, this));
    walker = walker.next;
  }
  return res;
};
Yallist.prototype.mapReverse = function (fn, thisp) {
  thisp = thisp || this;
  var res = new Yallist();
  for (var walker = this.tail; walker !== null;) {
    res.push(fn.call(thisp, walker.value, this));
    walker = walker.prev;
  }
  return res;
};
Yallist.prototype.reduce = function (fn, initial) {
  var acc;
  var walker = this.head;
  if (arguments.length > 1) {
    acc = initial;
  } else if (this.head) {
    walker = this.head.next;
    acc = this.head.value;
  } else {
    throw new TypeError('Reduce of empty list with no initial value');
  }
  for (var i = 0; walker !== null; i++) {
    acc = fn(acc, walker.value, i);
    walker = walker.next;
  }
  return acc;
};
Yallist.prototype.reduceReverse = function (fn, initial) {
  var acc;
  var walker = this.tail;
  if (arguments.length > 1) {
    acc = initial;
  } else if (this.tail) {
    walker = this.tail.prev;
    acc = this.tail.value;
  } else {
    throw new TypeError('Reduce of empty list with no initial value');
  }
  for (var i = this.length - 1; walker !== null; i--) {
    acc = fn(acc, walker.value, i);
    walker = walker.prev;
  }
  return acc;
};
Yallist.prototype.toArray = function () {
  var arr = new Array(this.length);
  for (var i = 0, walker = this.head; walker !== null; i++) {
    arr[i] = walker.value;
    walker = walker.next;
  }
  return arr;
};
Yallist.prototype.toArrayReverse = function () {
  var arr = new Array(this.length);
  for (var i = 0, walker = this.tail; walker !== null; i++) {
    arr[i] = walker.value;
    walker = walker.prev;
  }
  return arr;
};
Yallist.prototype.slice = function (from, to) {
  to = to || this.length;
  if (to < 0) {
    to += this.length;
  }
  from = from || 0;
  if (from < 0) {
    from += this.length;
  }
  var ret = new Yallist();
  if (to < from || to < 0) {
    return ret;
  }
  if (from < 0) {
    from = 0;
  }
  if (to > this.length) {
    to = this.length;
  }
  for (var i = 0, walker = this.head; walker !== null && i < from; i++) {
    walker = walker.next;
  }
  for (; walker !== null && i < to; i++, walker = walker.next) {
    ret.push(walker.value);
  }
  return ret;
};
Yallist.prototype.sliceReverse = function (from, to) {
  to = to || this.length;
  if (to < 0) {
    to += this.length;
  }
  from = from || 0;
  if (from < 0) {
    from += this.length;
  }
  var ret = new Yallist();
  if (to < from || to < 0) {
    return ret;
  }
  if (from < 0) {
    from = 0;
  }
  if (to > this.length) {
    to = this.length;
  }
  for (var i = this.length, walker = this.tail; walker !== null && i > to; i--) {
    walker = walker.prev;
  }
  for (; walker !== null && i > from; i--, walker = walker.prev) {
    ret.push(walker.value);
  }
  return ret;
};
Yallist.prototype.splice = function (start, deleteCount) {
  if (start > this.length) {
    start = this.length - 1;
  }
  if (start < 0) {
    start = this.length + start;
  }
  for (var i = 0, walker = this.head; walker !== null && i < start; i++) {
    walker = walker.next;
  }
  var ret = [];
  for (var i = 0; walker && i < deleteCount; i++) {
    ret.push(walker.value);
    walker = this.removeNode(walker);
  }
  if (walker === null) {
    walker = this.tail;
  }
  if (walker !== this.head && walker !== this.tail) {
    walker = walker.prev;
  }
  for (var i = 2; i < arguments.length; i++) {
    walker = insert(this, walker, arguments[i]);
  }
  return ret;
};
Yallist.prototype.reverse = function () {
  var head = this.head;
  var tail = this.tail;
  for (var walker = head; walker !== null; walker = walker.prev) {
    var p = walker.prev;
    walker.prev = walker.next;
    walker.next = p;
  }
  this.head = tail;
  this.tail = head;
  return this;
};
function insert(self, node, value) {
  var inserted = node === self.head ? new Node(value, null, node, self) : new Node(value, node, node.next, self);
  if (inserted.next === null) {
    self.tail = inserted;
  }
  if (inserted.prev === null) {
    self.head = inserted;
  }
  self.length++;
  return inserted;
}
function push(self, item) {
  self.tail = new Node(item, self.tail, null, self);
  if (!self.head) {
    self.head = self.tail;
  }
  self.length++;
}
function unshift(self, item) {
  self.head = new Node(item, null, self.head, self);
  if (!self.tail) {
    self.tail = self.head;
  }
  self.length++;
}
function Node(value, prev, next, list) {
  if (!(this instanceof Node)) {
    return new Node(value, prev, next, list);
  }
  this.list = list;
  this.value = value;
  if (prev) {
    prev.next = this;
    this.prev = prev;
  } else {
    this.prev = null;
  }
  if (next) {
    next.prev = this;
    this.next = next;
  } else {
    this.next = null;
  }
}
try {
  __webpack_require__(476)(Yallist);
} catch (er) {}

/***/ }),

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
  "endRecording": () => (/* reexport */ endRecording),
  "installHook": () => (/* binding */ installHook),
  "onCommitFiber": () => (/* reexport */ onCommitFiber),
  "startRecording": () => (/* reexport */ startRecording)
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
const ReactSymbols_REACT_LEGACY_ELEMENT_TYPE = Symbol.for('react.element');
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
;// CONCATENATED MODULE: ./src/didStatefulHookChange.js
const didStatefulHookChange_hasOwnProperty = Object.prototype.hasOwnProperty;
function isUseSyncExternalStoreHook(hookObject) {
  const queue = hookObject.queue;
  if (!queue) {
    return false;
  }
  const boundHasOwnProperty = didStatefulHookChange_hasOwnProperty.bind(queue);
  return boundHasOwnProperty('value') && boundHasOwnProperty('getSnapshot') && typeof queue.getSnapshot === 'function';
}
function isHookThatCanScheduleUpdate(hookObject) {
  const queue = hookObject.queue;
  if (!queue) {
    return false;
  }
  const boundHasOwnProperty = didStatefulHookChange_hasOwnProperty.bind(queue);
  if (boundHasOwnProperty('pending')) {
    return true;
  }
  return isUseSyncExternalStoreHook(hookObject);
}
function didStatefulHookChange_didStatefulHookChange(prev, next) {
  const prevMemoizedState = prev.memoizedState;
  const nextMemoizedState = next.memoizedState;
  if (isHookThatCanScheduleUpdate(prev)) {
    return prevMemoizedState !== nextMemoizedState;
  }
  return false;
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
;// CONCATENATED MODULE: ./src/collectFiberChanges.js




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
function getActualDuration(fiber) {
  return fiber.actualDuration != null ? fiber.actualDuration : null;
}
function getSelfDuration(fiber) {
  const actualDuration = getActualDuration(fiber);
  if (actualDuration === null) {
    return null;
  }
  let selfDuration = actualDuration;
  let child = fiber.child;
  while (child !== null) {
    selfDuration -= child.actualDuration || 0;
    child = child.sibling;
  }
  return selfDuration;
}
function collectFiberChanges_getChangedHooksIndices(prev, next) {
  if (prev == null || next == null) {
    return null;
  }
  const detected = [];
  let index = 0;
  while (next !== null) {
    if (didStatefulHookChange_didStatefulHookChange(prev, next)) {
      detected.push({
        hookIndex: index,
        prev: prev.memoizedState,
        next: next.memoizedState
      });
    }
    next = next.next;
    prev = prev.next;
    index++;
  }
  return detected;
}
function getChangeDescription(prevFiber, nextFiber) {
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
      const detectedHooks = collectFiberChanges_getChangedHooksIndices(prevFiber.memoizedState, nextFiber.memoizedState);
      return {
        context: getContextChanged(prevFiber, nextFiber),
        didHooksChange: detectedHooks !== null && detectedHooks.length > 0,
        hooks: detectedHooks,
        isFirstMount: false,
        props: getChangedKeys(prevFiber.memoizedProps, nextFiber.memoizedProps),
        state: null
      };
    default:
      return null;
  }
}
function collectFiberChanges(fiber, changes, mountedFibers) {
  if (fiber === null) {
    return;
  }
  const prevFiber = fiber.alternate;
  if (prevFiber === null) {
    if (!mountedFibers.has(fiber)) {
      const changeDescription = getChangeDescription(prevFiber, fiber);
      if (changeDescription !== null) {
        changes.push({
          ...changeDescription,
          actualDuration: getActualDuration(fiber),
          displayName: getDisplayNameForFiber(fiber),
          fiber,
          prevFiber,
          selfDuration: getSelfDuration(fiber)
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
        selfDuration: getSelfDuration(fiber)
      });
    }
  }
  collectFiberChanges(fiber.child, changes, mountedFibers);
  collectFiberChanges(fiber.sibling, changes, mountedFibers);
}
// EXTERNAL MODULE: ../../node_modules/lru-cache/index.js
var lru_cache = __webpack_require__(730);
var lru_cache_default = /*#__PURE__*/__webpack_require__.n(lru_cache);
;// CONCATENATED MODULE: ../react-devtools-shared/src/hydration.js



const meta = {
  inspectable: Symbol('inspectable'),
  inspected: Symbol('inspected'),
  name: Symbol('name'),
  preview_long: Symbol('preview_long'),
  preview_short: Symbol('preview_short'),
  readonly: Symbol('readonly'),
  size: Symbol('size'),
  type: Symbol('type'),
  unserializable: Symbol('unserializable')
};
const LEVEL_THRESHOLD = 2;
function createDehydrated(type, inspectable, data, cleaned, path) {
  cleaned.push(path);
  const dehydrated = {
    inspectable,
    type,
    preview_long: formatDataForPreview(data, true),
    preview_short: formatDataForPreview(data, false),
    name: typeof data.constructor !== 'function' || typeof data.constructor.name !== 'string' || data.constructor.name === 'Object' ? '' : data.constructor.name
  };
  if (type === 'array' || type === 'typed_array') {
    dehydrated.size = data.length;
  } else if (type === 'object') {
    dehydrated.size = Object.keys(data).length;
  }
  if (type === 'iterator' || type === 'typed_array') {
    dehydrated.readonly = true;
  }
  return dehydrated;
}
function hydration_dehydrate(data, cleaned, unserializable, path, isPathAllowed, level = 0) {
  const type = getDataType(data);
  let isPathAllowedCheck;
  switch (type) {
    case 'html_element':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: data.tagName,
        type
      };
    case 'function':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: typeof data.name === 'function' || !data.name ? 'function' : data.name,
        type
      };
    case 'string':
      isPathAllowedCheck = isPathAllowed(path);
      if (isPathAllowedCheck) {
        return data;
      } else {
        return data.length <= 500 ? data : data.slice(0, 500) + '...';
      }
    case 'bigint':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: data.toString(),
        type
      };
    case 'symbol':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: data.toString(),
        type
      };
    case 'react_element':
      {
        isPathAllowedCheck = isPathAllowed(path);
        if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
          cleaned.push(path);
          return {
            inspectable: true,
            preview_short: formatDataForPreview(data, false),
            preview_long: formatDataForPreview(data, true),
            name: getDisplayNameForReactElement(data) || 'Unknown',
            type
          };
        }
        const unserializableValue = {
          unserializable: true,
          type,
          readonly: true,
          preview_short: formatDataForPreview(data, false),
          preview_long: formatDataForPreview(data, true),
          name: getDisplayNameForReactElement(data) || 'Unknown'
        };
        unserializableValue.key = hydration_dehydrate(data.key, cleaned, unserializable, path.concat(['key']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        if (data.$$typeof === REACT_LEGACY_ELEMENT_TYPE) {
          unserializableValue.ref = hydration_dehydrate(data.ref, cleaned, unserializable, path.concat(['ref']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        }
        unserializableValue.props = hydration_dehydrate(data.props, cleaned, unserializable, path.concat(['props']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        unserializable.push(path);
        return unserializableValue;
      }
    case 'react_lazy':
      {
        isPathAllowedCheck = isPathAllowed(path);
        const payload = data._payload;
        if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
          cleaned.push(path);
          const inspectable = payload !== null && typeof payload === 'object' && (payload._status === 1 || payload._status === 2 || payload.status === 'fulfilled' || payload.status === 'rejected');
          return {
            inspectable,
            preview_short: formatDataForPreview(data, false),
            preview_long: formatDataForPreview(data, true),
            name: 'lazy()',
            type
          };
        }
        const unserializableValue = {
          unserializable: true,
          type: type,
          preview_short: formatDataForPreview(data, false),
          preview_long: formatDataForPreview(data, true),
          name: 'lazy()'
        };
        unserializableValue._payload = hydration_dehydrate(payload, cleaned, unserializable, path.concat(['_payload']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        unserializable.push(path);
        return unserializableValue;
      }
    case 'array_buffer':
    case 'data_view':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: type === 'data_view' ? 'DataView' : 'ArrayBuffer',
        size: data.byteLength,
        type
      };
    case 'array':
      isPathAllowedCheck = isPathAllowed(path);
      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        return createDehydrated(type, true, data, cleaned, path);
      }
      const arr = [];
      for (let i = 0; i < data.length; i++) {
        arr[i] = dehydrateKey(data, i, cleaned, unserializable, path.concat([i]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
      }
      return arr;
    case 'html_all_collection':
    case 'typed_array':
    case 'iterator':
      isPathAllowedCheck = isPathAllowed(path);
      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        return createDehydrated(type, true, data, cleaned, path);
      } else {
        const unserializableValue = {
          unserializable: true,
          type: type,
          readonly: true,
          size: type === 'typed_array' ? data.length : undefined,
          preview_short: formatDataForPreview(data, false),
          preview_long: formatDataForPreview(data, true),
          name: typeof data.constructor !== 'function' || typeof data.constructor.name !== 'string' || data.constructor.name === 'Object' ? '' : data.constructor.name
        };
        Array.from(data).forEach((item, i) => unserializableValue[i] = hydration_dehydrate(item, cleaned, unserializable, path.concat([i]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1));
        unserializable.push(path);
        return unserializableValue;
      }
    case 'opaque_iterator':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: data[Symbol.toStringTag],
        type
      };
    case 'date':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: data.toString(),
        type
      };
    case 'regexp':
      cleaned.push(path);
      return {
        inspectable: false,
        preview_short: formatDataForPreview(data, false),
        preview_long: formatDataForPreview(data, true),
        name: data.toString(),
        type
      };
    case 'thenable':
      isPathAllowedCheck = isPathAllowed(path);
      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        cleaned.push(path);
        return {
          inspectable: data.status === 'fulfilled' || data.status === 'rejected',
          preview_short: formatDataForPreview(data, false),
          preview_long: formatDataForPreview(data, true),
          name: data.toString(),
          type
        };
      }
      if (data.status === 'resolved_model' || data.status === 'resolve_module') {
        data.then(noop);
      }
      switch (data.status) {
        case 'fulfilled':
          {
            const unserializableValue = {
              unserializable: true,
              type: type,
              preview_short: formatDataForPreview(data, false),
              preview_long: formatDataForPreview(data, true),
              name: 'fulfilled Thenable'
            };
            unserializableValue.value = hydration_dehydrate(data.value, cleaned, unserializable, path.concat(['value']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
            unserializable.push(path);
            return unserializableValue;
          }
        case 'rejected':
          {
            const unserializableValue = {
              unserializable: true,
              type: type,
              preview_short: formatDataForPreview(data, false),
              preview_long: formatDataForPreview(data, true),
              name: 'rejected Thenable'
            };
            unserializableValue.reason = hydration_dehydrate(data.reason, cleaned, unserializable, path.concat(['reason']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
            unserializable.push(path);
            return unserializableValue;
          }
        default:
          cleaned.push(path);
          return {
            inspectable: false,
            preview_short: formatDataForPreview(data, false),
            preview_long: formatDataForPreview(data, true),
            name: data.toString(),
            type
          };
      }
    case 'object':
      isPathAllowedCheck = isPathAllowed(path);
      if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
        return createDehydrated(type, true, data, cleaned, path);
      } else {
        const object = {};
        getAllEnumerableKeys(data).forEach(key => {
          const name = key.toString();
          object[name] = dehydrateKey(data, key, cleaned, unserializable, path.concat([name]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        });
        return object;
      }
    case 'class_instance':
      {
        isPathAllowedCheck = isPathAllowed(path);
        if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
          return createDehydrated(type, true, data, cleaned, path);
        }
        const value = {
          unserializable: true,
          type,
          readonly: true,
          preview_short: formatDataForPreview(data, false),
          preview_long: formatDataForPreview(data, true),
          name: typeof data.constructor !== 'function' || typeof data.constructor.name !== 'string' ? '' : data.constructor.name
        };
        getAllEnumerableKeys(data).forEach(key => {
          const keyAsString = key.toString();
          value[keyAsString] = hydration_dehydrate(data[key], cleaned, unserializable, path.concat([keyAsString]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        });
        unserializable.push(path);
        return value;
      }
    case 'error':
      {
        isPathAllowedCheck = isPathAllowed(path);
        if (level >= LEVEL_THRESHOLD && !isPathAllowedCheck) {
          return createDehydrated(type, true, data, cleaned, path);
        }
        const value = {
          unserializable: true,
          type,
          readonly: true,
          preview_short: formatDataForPreview(data, false),
          preview_long: formatDataForPreview(data, true),
          name: data.name
        };
        value.message = hydration_dehydrate(data.message, cleaned, unserializable, path.concat(['message']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        value.stack = hydration_dehydrate(data.stack, cleaned, unserializable, path.concat(['stack']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        if ('cause' in data) {
          value.cause = hydration_dehydrate(data.cause, cleaned, unserializable, path.concat(['cause']), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        }
        getAllEnumerableKeys(data).forEach(key => {
          const keyAsString = key.toString();
          value[keyAsString] = hydration_dehydrate(data[key], cleaned, unserializable, path.concat([keyAsString]), isPathAllowed, isPathAllowedCheck ? 1 : level + 1);
        });
        unserializable.push(path);
        return value;
      }
    case 'infinity':
    case 'nan':
    case 'undefined':
      cleaned.push(path);
      return {
        type
      };
    default:
      return data;
  }
}
function dehydrateKey(parent, key, cleaned, unserializable, path, isPathAllowed, level = 0) {
  try {
    return hydration_dehydrate(parent[key], cleaned, unserializable, path, isPathAllowed, level);
  } catch (error) {
    let preview = '';
    if (typeof error === 'object' && error !== null && typeof error.stack === 'string') {
      preview = error.stack;
    } else if (typeof error === 'string') {
      preview = error;
    }
    cleaned.push(path);
    return {
      inspectable: false,
      preview_short: '[Exception]',
      preview_long: preview ? '[Exception: ' + preview + ']' : '[Exception]',
      name: preview,
      type: 'unknown'
    };
  }
}
function fillInPath(object, data, path, value) {
  const target = getInObject(object, path);
  if (target != null) {
    if (!target[meta.unserializable]) {
      delete target[meta.inspectable];
      delete target[meta.inspected];
      delete target[meta.name];
      delete target[meta.preview_long];
      delete target[meta.preview_short];
      delete target[meta.readonly];
      delete target[meta.size];
      delete target[meta.type];
    }
  }
  if (value !== null && data.unserializable.length > 0) {
    const unserializablePath = data.unserializable[0];
    let isMatch = unserializablePath.length === path.length;
    for (let i = 0; i < path.length; i++) {
      if (path[i] !== unserializablePath[i]) {
        isMatch = false;
        break;
      }
    }
    if (isMatch) {
      upgradeUnserializable(value, value);
    }
  }
  setInObject(object, path, value);
}
function hydrate(object, cleaned, unserializable) {
  cleaned.forEach(path => {
    const length = path.length;
    const last = path[length - 1];
    const parent = getInObject(object, path.slice(0, length - 1));
    if (!parent || !parent.hasOwnProperty(last)) {
      return;
    }
    const value = parent[last];
    if (!value) {
      return;
    } else if (value.type === 'infinity') {
      parent[last] = Infinity;
    } else if (value.type === 'nan') {
      parent[last] = NaN;
    } else if (value.type === 'undefined') {
      parent[last] = undefined;
    } else {
      const replaced = {};
      replaced[meta.inspectable] = !!value.inspectable;
      replaced[meta.inspected] = false;
      replaced[meta.name] = value.name;
      replaced[meta.preview_long] = value.preview_long;
      replaced[meta.preview_short] = value.preview_short;
      replaced[meta.size] = value.size;
      replaced[meta.readonly] = !!value.readonly;
      replaced[meta.type] = value.type;
      parent[last] = replaced;
    }
  });
  unserializable.forEach(path => {
    const length = path.length;
    const last = path[length - 1];
    const parent = getInObject(object, path.slice(0, length - 1));
    if (!parent || !parent.hasOwnProperty(last)) {
      return;
    }
    const node = parent[last];
    const replacement = {
      ...node
    };
    upgradeUnserializable(replacement, node);
    parent[last] = replacement;
  });
  return object;
}
function upgradeUnserializable(destination, source) {
  Object.defineProperties(destination, {
    [meta.inspected]: {
      configurable: true,
      enumerable: false,
      value: !!source.inspected
    },
    [meta.name]: {
      configurable: true,
      enumerable: false,
      value: source.name
    },
    [meta.preview_long]: {
      configurable: true,
      enumerable: false,
      value: source.preview_long
    },
    [meta.preview_short]: {
      configurable: true,
      enumerable: false,
      value: source.preview_short
    },
    [meta.size]: {
      configurable: true,
      enumerable: false,
      value: source.size
    },
    [meta.readonly]: {
      configurable: true,
      enumerable: false,
      value: !!source.readonly
    },
    [meta.type]: {
      configurable: true,
      enumerable: false,
      value: source.type
    },
    [meta.unserializable]: {
      configurable: true,
      enumerable: false,
      value: !!source.unserializable
    }
  });
  delete destination.inspected;
  delete destination.name;
  delete destination.preview_long;
  delete destination.preview_short;
  delete destination.size;
  delete destination.readonly;
  delete destination.type;
  delete destination.unserializable;
}
;// CONCATENATED MODULE: ../react-devtools-shared/src/isArray.js
const isArray_isArray = Array.isArray;
/* harmony default export */ const src_isArray = (isArray_isArray);
;// CONCATENATED MODULE: ../shared/isArray.js
const isArrayImpl = Array.isArray;
function shared_isArray_isArray(a) {
  return isArrayImpl(a);
}
/* harmony default export */ const shared_isArray = ((/* unused pure expression or super */ null && (shared_isArray_isArray)));
;// CONCATENATED MODULE: ../react-devtools-shared/src/backend/utils/index.js





const FIRST_DEVTOOLS_BACKEND_LOCKSTEP_VER = '999.9.9';
function hasAssignedBackend(version) {
  if (version == null || version === '') {
    return false;
  }
  return gte(version, FIRST_DEVTOOLS_BACKEND_LOCKSTEP_VER);
}
function cleanForBridge(data, isPathAllowed, path = []) {
  if (data !== null) {
    const cleanedPaths = [];
    const unserializablePaths = [];
    const cleanedData = dehydrate(data, cleanedPaths, unserializablePaths, path, isPathAllowed);
    return {
      data: cleanedData,
      cleaned: cleanedPaths,
      unserializable: unserializablePaths
    };
  } else {
    return null;
  }
}
function copyWithDelete(obj, path, index = 0) {
  const key = path[index];
  const updated = isArray(obj) ? obj.slice() : {
    ...obj
  };
  if (index + 1 === path.length) {
    if (isArray(updated)) {
      updated.splice(key, 1);
    } else {
      delete updated[key];
    }
  } else {
    updated[key] = copyWithDelete(obj[key], path, index + 1);
  }
  return updated;
}
function copyWithRename(obj, oldPath, newPath, index = 0) {
  const oldKey = oldPath[index];
  const updated = isArray(obj) ? obj.slice() : {
    ...obj
  };
  if (index + 1 === oldPath.length) {
    const newKey = newPath[index];
    updated[newKey] = updated[oldKey];
    if (isArray(updated)) {
      updated.splice(oldKey, 1);
    } else {
      delete updated[oldKey];
    }
  } else {
    updated[oldKey] = copyWithRename(obj[oldKey], oldPath, newPath, index + 1);
  }
  return updated;
}
function copyWithSet(obj, path, value, index = 0) {
  if (index >= path.length) {
    return value;
  }
  const key = path[index];
  const updated = isArray(obj) ? obj.slice() : {
    ...obj
  };
  updated[key] = copyWithSet(obj[key], path, value, index + 1);
  return updated;
}
function getEffectDurations(root) {
  let effectDuration = null;
  let passiveEffectDuration = null;
  const hostRoot = root.current;
  if (hostRoot != null) {
    const stateNode = hostRoot.stateNode;
    if (stateNode != null) {
      effectDuration = stateNode.effectDuration != null ? stateNode.effectDuration : null;
      passiveEffectDuration = stateNode.passiveEffectDuration != null ? stateNode.passiveEffectDuration : null;
    }
  }
  return {
    effectDuration,
    passiveEffectDuration
  };
}
function serializeToString(data) {
  if (data === undefined) {
    return 'undefined';
  }
  if (typeof data === 'function') {
    return data.toString();
  }
  const cache = new Set();
  return JSON.stringify(data, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return;
      }
      cache.add(value);
    }
    if (typeof value === 'bigint') {
      return value.toString() + 'n';
    }
    return value;
  }, 2);
}
function safeToString(val) {
  try {
    return String(val);
  } catch (err) {
    if (typeof val === 'object') {
      return '[object Object]';
    }
    throw err;
  }
}
function formatConsoleArgumentsToSingleString(maybeMessage, ...inputArgs) {
  const args = inputArgs.slice();
  let formatted = safeToString(maybeMessage);
  if (typeof maybeMessage === 'string') {
    if (args.length) {
      const REGEXP = /(%?)(%([jds]))/g;
      formatted = formatted.replace(REGEXP, (match, escaped, ptn, flag) => {
        let arg = args.shift();
        switch (flag) {
          case 's':
            arg += '';
            break;
          case 'd':
          case 'i':
            arg = parseInt(arg, 10).toString();
            break;
          case 'f':
            arg = parseFloat(arg).toString();
            break;
        }
        if (!escaped) {
          return arg;
        }
        args.unshift(arg);
        return match;
      });
    }
  }
  if (args.length) {
    for (let i = 0; i < args.length; i++) {
      formatted += ' ' + safeToString(args[i]);
    }
  }
  formatted = formatted.replace(/%{2,2}/g, '%');
  return String(formatted);
}
function utils_isSynchronousXHRSupported() {
  return !!(window.document && window.document.featurePolicy && window.document.featurePolicy.allowsFeature('sync-xhr'));
}
function gt(a = '', b = '') {
  return compareVersions(a, b) === 1;
}
function gte(a = '', b = '') {
  return compareVersions(a, b) > -1;
}
const isReactNativeEnvironment = () => {
  return window.document == null;
};
function formatDurationToMicrosecondsGranularity(duration) {
  return Math.round(duration * 1000) / 1000;
}
;// CONCATENATED MODULE: ../react-devtools-shared/src/utils.js









const utils_hasOwnProperty = Object.prototype.hasOwnProperty;
const cachedDisplayNames = new WeakMap();
const encodedStringCache = new (lru_cache_default())({
  max: 1000
});
const LEGACY_REACT_PROVIDER_TYPE = Symbol.for('react.provider');
function alphaSortKeys(a, b) {
  if (a.toString() > b.toString()) {
    return 1;
  } else if (b.toString() > a.toString()) {
    return -1;
  } else {
    return 0;
  }
}
function utils_getAllEnumerableKeys(obj) {
  const keys = new Set();
  let current = obj;
  while (current != null) {
    const currentKeys = [...Object.keys(current), ...Object.getOwnPropertySymbols(current)];
    const descriptors = Object.getOwnPropertyDescriptors(current);
    currentKeys.forEach(key => {
      if (descriptors[key].enumerable) {
        keys.add(key);
      }
    });
    current = Object.getPrototypeOf(current);
  }
  return keys;
}
function getWrappedDisplayName(outerType, innerType, wrapperName, fallbackName) {
  const displayName = outerType?.displayName;
  return displayName || `${wrapperName}(${getDisplayName(innerType, fallbackName)})`;
}
function getDisplayName(type, fallbackName = 'Anonymous') {
  const nameFromCache = cachedDisplayNames.get(type);
  if (nameFromCache != null) {
    return nameFromCache;
  }
  let displayName = fallbackName;
  if (typeof type.displayName === 'string') {
    displayName = type.displayName;
  } else if (typeof type.name === 'string' && type.name !== '') {
    displayName = type.name;
  }
  cachedDisplayNames.set(type, displayName);
  return displayName;
}
let uidCounter = 0;
function getUID() {
  return ++uidCounter;
}
function utfDecodeStringWithRanges(array, left, right) {
  let string = '';
  for (let i = left; i <= right; i++) {
    string += String.fromCodePoint(array[i]);
  }
  return string;
}
function surrogatePairToCodePoint(charCode1, charCode2) {
  return ((charCode1 & 0x3ff) << 10) + (charCode2 & 0x3ff) + 0x10000;
}
function utfEncodeString(string) {
  const cached = encodedStringCache.get(string);
  if (cached !== undefined) {
    return cached;
  }
  const encoded = [];
  let i = 0;
  let charCode;
  while (i < string.length) {
    charCode = string.charCodeAt(i);
    if ((charCode & 0xf800) === 0xd800) {
      encoded.push(surrogatePairToCodePoint(charCode, string.charCodeAt(++i)));
    } else {
      encoded.push(charCode);
    }
    ++i;
  }
  encodedStringCache.set(string, encoded);
  return encoded;
}
function printOperationsArray(operations) {
  const rendererID = operations[0];
  const rootID = operations[1];
  const logs = [`operations for renderer:${rendererID} and root:${rootID}`];
  let i = 2;
  const stringTable = [null];
  const stringTableSize = operations[i++];
  const stringTableEnd = i + stringTableSize;
  while (i < stringTableEnd) {
    const nextLength = operations[i++];
    const nextString = utfDecodeStringWithRanges(operations, i, i + nextLength - 1);
    stringTable.push(nextString);
    i += nextLength;
  }
  while (i < operations.length) {
    const operation = operations[i];
    switch (operation) {
      case TREE_OPERATION_ADD:
        {
          const id = operations[i + 1];
          const type = operations[i + 2];
          i += 3;
          if (type === ElementTypeRoot) {
            logs.push(`Add new root node ${id}`);
            i++;
            i++;
            i++;
            i++;
          } else {
            const parentID = operations[i];
            i++;
            i++;
            const displayNameStringID = operations[i];
            const displayName = stringTable[displayNameStringID];
            i++;
            i++;
            i++;
            logs.push(`Add node ${id} (${displayName || 'null'}) as child of ${parentID}`);
          }
          break;
        }
      case TREE_OPERATION_REMOVE:
        {
          const removeLength = operations[i + 1];
          i += 2;
          for (let removeIndex = 0; removeIndex < removeLength; removeIndex++) {
            const id = operations[i];
            i += 1;
            logs.push(`Remove node ${id}`);
          }
          break;
        }
      case TREE_OPERATION_SET_SUBTREE_MODE:
        {
          const id = operations[i + 1];
          const mode = operations[i + 2];
          i += 3;
          logs.push(`Mode ${mode} set for subtree with root ${id}`);
          break;
        }
      case TREE_OPERATION_REORDER_CHILDREN:
        {
          const id = operations[i + 1];
          const numChildren = operations[i + 2];
          i += 3;
          const children = operations.slice(i, i + numChildren);
          i += numChildren;
          logs.push(`Re-order node ${id} children ${children.join(',')}`);
          break;
        }
      case TREE_OPERATION_UPDATE_TREE_BASE_DURATION:
        i += 3;
        break;
      case TREE_OPERATION_UPDATE_ERRORS_OR_WARNINGS:
        {
          const id = operations[i + 1];
          const numErrors = operations[i + 2];
          const numWarnings = operations[i + 3];
          i += 4;
          logs.push(`Node ${id} has ${numErrors} errors and ${numWarnings} warnings`);
          break;
        }
      case SUSPENSE_TREE_OPERATION_ADD:
        {
          const fiberID = operations[i + 1];
          const parentID = operations[i + 2];
          const nameStringID = operations[i + 3];
          const isSuspended = operations[i + 4];
          const numRects = operations[i + 5];
          i += 6;
          const name = stringTable[nameStringID];
          let rects;
          if (numRects === -1) {
            rects = 'null';
          } else {
            rects = '[';
            for (let rectIndex = 0; rectIndex < numRects; rectIndex++) {
              const offset = i + rectIndex * 4;
              const x = operations[offset + 0];
              const y = operations[offset + 1];
              const width = operations[offset + 2];
              const height = operations[offset + 3];
              if (rectIndex > 0) {
                rects += ', ';
              }
              rects += `(${x}, ${y}, ${width}, ${height})`;
              i += 4;
            }
            rects += ']';
          }
          logs.push(`Add suspense node ${fiberID} (${String(name)},rects={${rects}}) under ${parentID} suspended ${isSuspended}`);
          break;
        }
      case SUSPENSE_TREE_OPERATION_REMOVE:
        {
          const removeLength = operations[i + 1];
          i += 2;
          for (let removeIndex = 0; removeIndex < removeLength; removeIndex++) {
            const id = operations[i];
            i += 1;
            logs.push(`Remove suspense node ${id}`);
          }
          break;
        }
      case SUSPENSE_TREE_OPERATION_REORDER_CHILDREN:
        {
          const id = operations[i + 1];
          const numChildren = operations[i + 2];
          i += 3;
          const children = operations.slice(i, i + numChildren);
          i += numChildren;
          logs.push(`Re-order suspense node ${id} children ${children.join(',')}`);
          break;
        }
      case SUSPENSE_TREE_OPERATION_RESIZE:
        {
          const id = operations[i + 1];
          const numRects = operations[i + 2];
          i += 3;
          if (numRects === -1) {
            logs.push(`Resize suspense node ${id} to null`);
          } else {
            let line = `Resize suspense node ${id} to [`;
            for (let rectIndex = 0; rectIndex < numRects; rectIndex++) {
              const x = operations[i + 0];
              const y = operations[i + 1];
              const width = operations[i + 2];
              const height = operations[i + 3];
              if (rectIndex > 0) {
                line += ', ';
              }
              line += `(${x}, ${y}, ${width}, ${height})`;
              i += 4;
            }
            logs.push(line + ']');
          }
          break;
        }
      case SUSPENSE_TREE_OPERATION_SUSPENDERS:
        {
          i++;
          const changeLength = operations[i++];
          for (let changeIndex = 0; changeIndex < changeLength; changeIndex++) {
            const id = operations[i++];
            const hasUniqueSuspenders = operations[i++] === 1;
            const endTime = operations[i++] / 1000;
            const isSuspended = operations[i++] === 1;
            const environmentNamesLength = operations[i++];
            i += environmentNamesLength;
            logs.push(`Suspense node ${id} unique suspenders set to ${String(hasUniqueSuspenders)} ending at ${String(endTime)} is suspended set to ${String(isSuspended)} with ${String(environmentNamesLength)} environments`);
          }
          break;
        }
      case TREE_OPERATION_APPLIED_ACTIVITY_SLICE_CHANGE:
        {
          i++;
          const activitySliceIDChange = operations[i + 1];
          logs.push(activitySliceIDChange === 0 ? 'Reset applied activity slice' : 'Applied activity slice change to ' + activitySliceIDChange);
          break;
        }
      default:
        throw Error(`Unsupported Bridge operation "${operation}"`);
    }
  }
  console.log(logs.join('\n  '));
}
function getDefaultComponentFilters() {
  return [{
    type: ComponentFilterElementType,
    value: ElementTypeHostComponent,
    isEnabled: true
  }];
}
function getSavedComponentFilters() {
  try {
    const raw = localStorageGetItem(LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY);
    if (raw != null) {
      const parsedFilters = JSON.parse(raw);
      return persistableComponentFilters(parsedFilters);
    }
  } catch (error) {}
  return getDefaultComponentFilters();
}
function setSavedComponentFilters(componentFilters) {
  localStorageSetItem(LOCAL_STORAGE_COMPONENT_FILTER_PREFERENCES_KEY, JSON.stringify(persistableComponentFilters(componentFilters)));
}
function persistableComponentFilters(componentFilters) {
  if (!Array.isArray(componentFilters)) {
    return componentFilters;
  }
  return componentFilters.filter(f => {
    return f.type !== ComponentFilterLocation && f.type !== ComponentFilterActivitySlice;
  });
}
const vscodeFilepath = 'vscode://file/{path}:{line}:{column}';
function getDefaultPreset() {
  return typeof process.env.EDITOR_URL === 'string' ? 'custom' : 'vscode';
}
function getDefaultOpenInEditorURL() {
  return typeof process.env.EDITOR_URL === 'string' ? process.env.EDITOR_URL : vscodeFilepath;
}
function getOpenInEditorURL() {
  try {
    const rawPreset = localStorageGetItem(LOCAL_STORAGE_OPEN_IN_EDITOR_URL_PRESET);
    switch (rawPreset) {
      case '"vscode"':
        return vscodeFilepath;
    }
    const raw = localStorageGetItem(LOCAL_STORAGE_OPEN_IN_EDITOR_URL);
    if (raw != null) {
      return JSON.parse(raw);
    }
  } catch (error) {}
  return getDefaultOpenInEditorURL();
}
function getAlwaysOpenInEditor() {
  try {
    const raw = localStorageGetItem(LOCAL_STORAGE_ALWAYS_OPEN_IN_EDITOR);
    return raw === 'true';
  } catch (error) {}
  return false;
}
function parseElementDisplayNameFromBackend(displayName, type) {
  if (displayName === null) {
    return {
      formattedDisplayName: null,
      hocDisplayNames: null,
      compiledWithForget: false
    };
  }
  if (displayName.startsWith('Forget(')) {
    const displayNameWithoutForgetWrapper = displayName.slice(7, displayName.length - 1);
    const {
      formattedDisplayName,
      hocDisplayNames
    } = parseElementDisplayNameFromBackend(displayNameWithoutForgetWrapper, type);
    return {
      formattedDisplayName,
      hocDisplayNames,
      compiledWithForget: true
    };
  }
  let hocDisplayNames = null;
  switch (type) {
    case ElementTypeClass:
    case ElementTypeForwardRef:
    case ElementTypeFunction:
    case ElementTypeMemo:
    case ElementTypeVirtual:
      if (displayName.indexOf('(') >= 0) {
        const matches = displayName.match(/[^()]+/g);
        if (matches != null) {
          displayName = matches.pop();
          hocDisplayNames = matches;
        }
      }
      break;
    default:
      break;
  }
  return {
    formattedDisplayName: displayName,
    hocDisplayNames,
    compiledWithForget: false
  };
}
function shallowDiffers(prev, next) {
  for (const attribute in prev) {
    if (!(attribute in next)) {
      return true;
    }
  }
  for (const attribute in next) {
    if (prev[attribute] !== next[attribute]) {
      return true;
    }
  }
  return false;
}
function utils_getInObject(object, path) {
  return path.reduce((reduced, attr) => {
    if (reduced) {
      if (utils_hasOwnProperty.call(reduced, attr)) {
        return reduced[attr];
      }
      if (typeof reduced[Symbol.iterator] === 'function') {
        return Array.from(reduced)[attr];
      }
    }
    return null;
  }, object);
}
function deletePathInObject(object, path) {
  const length = path.length;
  const last = path[length - 1];
  if (object != null) {
    const parent = utils_getInObject(object, path.slice(0, length - 1));
    if (parent) {
      if (isArray(parent)) {
        parent.splice(last, 1);
      } else {
        delete parent[last];
      }
    }
  }
}
function renamePathInObject(object, oldPath, newPath) {
  const length = oldPath.length;
  if (object != null) {
    const parent = utils_getInObject(object, oldPath.slice(0, length - 1));
    if (parent) {
      const lastOld = oldPath[length - 1];
      const lastNew = newPath[length - 1];
      parent[lastNew] = parent[lastOld];
      if (isArray(parent)) {
        parent.splice(lastOld, 1);
      } else {
        delete parent[lastOld];
      }
    }
  }
}
function utils_setInObject(object, path, value) {
  const length = path.length;
  const last = path[length - 1];
  if (object != null) {
    const parent = utils_getInObject(object, path.slice(0, length - 1));
    if (parent) {
      parent[last] = value;
    }
  }
}
function utils_isError(data) {
  if ('name' in data && 'message' in data) {
    while (data) {
      if (Object.prototype.toString.call(data) === '[object Error]') {
        return true;
      }
      data = Object.getPrototypeOf(data);
    }
  }
  return false;
}
function utils_getDataType(data) {
  if (data === null) {
    return 'null';
  } else if (data === undefined) {
    return 'undefined';
  }
  if (typeof HTMLElement !== 'undefined' && data instanceof HTMLElement) {
    return 'html_element';
  }
  const type = typeof data;
  switch (type) {
    case 'bigint':
      return 'bigint';
    case 'boolean':
      return 'boolean';
    case 'function':
      return 'function';
    case 'number':
      if (Number.isNaN(data)) {
        return 'nan';
      } else if (!Number.isFinite(data)) {
        return 'infinity';
      } else {
        return 'number';
      }
    case 'object':
      switch (data.$$typeof) {
        case REACT_ELEMENT_TYPE:
        case ReactSymbols_REACT_LEGACY_ELEMENT_TYPE:
          return 'react_element';
        case REACT_LAZY_TYPE:
          return 'react_lazy';
      }
      if (src_isArray(data)) {
        return 'array';
      } else if (ArrayBuffer.isView(data)) {
        return utils_hasOwnProperty.call(data.constructor, 'BYTES_PER_ELEMENT') ? 'typed_array' : 'data_view';
      } else if (data.constructor && data.constructor.name === 'ArrayBuffer') {
        return 'array_buffer';
      } else if (typeof data[Symbol.iterator] === 'function') {
        const iterator = data[Symbol.iterator]();
        if (!iterator) {} else {
          return iterator === data ? 'opaque_iterator' : 'iterator';
        }
      } else if (data.constructor && data.constructor.name === 'RegExp') {
        return 'regexp';
      } else if (typeof data.then === 'function') {
        return 'thenable';
      } else if (utils_isError(data)) {
        return 'error';
      } else {
        const toStringValue = Object.prototype.toString.call(data);
        if (toStringValue === '[object Date]') {
          return 'date';
        } else if (toStringValue === '[object HTMLAllCollection]') {
          return 'html_all_collection';
        }
      }
      if (!isPlainObject(data)) {
        return 'class_instance';
      }
      return 'object';
    case 'string':
      return 'string';
    case 'symbol':
      return 'symbol';
    case 'undefined':
      if (Object.prototype.toString.call(data) === '[object HTMLAllCollection]') {
        return 'html_all_collection';
      }
      return 'undefined';
    default:
      return 'unknown';
  }
}
function typeOfWithLegacyElementSymbol(object) {
  if (typeof object === 'object' && object !== null) {
    const $$typeof = object.$$typeof;
    switch ($$typeof) {
      case REACT_ELEMENT_TYPE:
      case ReactSymbols_REACT_LEGACY_ELEMENT_TYPE:
        const type = object.type;
        switch (type) {
          case REACT_FRAGMENT_TYPE:
          case REACT_PROFILER_TYPE:
          case REACT_STRICT_MODE_TYPE:
          case REACT_SUSPENSE_TYPE:
          case REACT_SUSPENSE_LIST_TYPE:
          case REACT_VIEW_TRANSITION_TYPE:
            return type;
          default:
            const $$typeofType = type && type.$$typeof;
            switch ($$typeofType) {
              case REACT_CONTEXT_TYPE:
              case REACT_FORWARD_REF_TYPE:
              case REACT_LAZY_TYPE:
              case REACT_MEMO_TYPE:
                return $$typeofType;
              case REACT_CONSUMER_TYPE:
                return $$typeofType;
              default:
                return $$typeof;
            }
        }
      case REACT_PORTAL_TYPE:
        return $$typeof;
    }
  }
  return undefined;
}
function utils_getDisplayNameForReactElement(element) {
  const elementType = typeOfWithLegacyElementSymbol(element);
  switch (elementType) {
    case REACT_CONSUMER_TYPE:
      return 'ContextConsumer';
    case LEGACY_REACT_PROVIDER_TYPE:
      return 'ContextProvider';
    case REACT_CONTEXT_TYPE:
      return 'Context';
    case REACT_FORWARD_REF_TYPE:
      return 'ForwardRef';
    case REACT_FRAGMENT_TYPE:
      return 'Fragment';
    case REACT_LAZY_TYPE:
      return 'Lazy';
    case REACT_MEMO_TYPE:
      return 'Memo';
    case REACT_PORTAL_TYPE:
      return 'Portal';
    case REACT_PROFILER_TYPE:
      return 'Profiler';
    case REACT_STRICT_MODE_TYPE:
      return 'StrictMode';
    case REACT_SUSPENSE_TYPE:
      return 'Suspense';
    case REACT_SUSPENSE_LIST_TYPE:
      return 'SuspenseList';
    case REACT_VIEW_TRANSITION_TYPE:
      return 'ViewTransition';
    case REACT_TRACING_MARKER_TYPE:
      return 'TracingMarker';
    default:
      const {
        type
      } = element;
      if (typeof type === 'string') {
        return type;
      } else if (typeof type === 'function') {
        return getDisplayName(type, 'Anonymous');
      } else if (type != null) {
        return 'NotImplementedInDevtools';
      } else {
        return 'Element';
      }
  }
}
const MAX_PREVIEW_STRING_LENGTH = 50;
function truncateForDisplay(string, length = MAX_PREVIEW_STRING_LENGTH) {
  if (string.length > length) {
    return string.slice(0, length) + '…';
  } else {
    return string;
  }
}
function utils_formatDataForPreview(data, showFormattedValue) {
  if (data != null && utils_hasOwnProperty.call(data, meta.type)) {
    return showFormattedValue ? data[meta.preview_long] : data[meta.preview_short];
  }
  const type = utils_getDataType(data);
  switch (type) {
    case 'html_element':
      return `<${truncateForDisplay(data.tagName.toLowerCase())} />`;
    case 'function':
      if (typeof data.name === 'function' || data.name === '') {
        return '() => {}';
      }
      return `${truncateForDisplay(data.name)}() {}`;
    case 'string':
      return `"${data}"`;
    case 'bigint':
      return truncateForDisplay(data.toString() + 'n');
    case 'regexp':
      return truncateForDisplay(data.toString());
    case 'symbol':
      return truncateForDisplay(data.toString());
    case 'react_element':
      return `<${truncateForDisplay(utils_getDisplayNameForReactElement(data) || 'Unknown')} />`;
    case 'react_lazy':
      const payload = data._payload;
      if (payload !== null && typeof payload === 'object') {
        if (payload._status === 0) {
          return `pending lazy()`;
        }
        if (payload._status === 1 && payload._result != null) {
          if (showFormattedValue) {
            const formatted = utils_formatDataForPreview(payload._result.default, false);
            return `fulfilled lazy() {${truncateForDisplay(formatted)}}`;
          } else {
            return `fulfilled lazy() {…}`;
          }
        }
        if (payload._status === 2) {
          if (showFormattedValue) {
            const formatted = utils_formatDataForPreview(payload._result, false);
            return `rejected lazy() {${truncateForDisplay(formatted)}}`;
          } else {
            return `rejected lazy() {…}`;
          }
        }
        if (payload.status === 'pending' || payload.status === 'blocked') {
          return `pending lazy()`;
        }
        if (payload.status === 'fulfilled') {
          if (showFormattedValue) {
            const formatted = utils_formatDataForPreview(payload.value, false);
            return `fulfilled lazy() {${truncateForDisplay(formatted)}}`;
          } else {
            return `fulfilled lazy() {…}`;
          }
        }
        if (payload.status === 'rejected') {
          if (showFormattedValue) {
            const formatted = utils_formatDataForPreview(payload.reason, false);
            return `rejected lazy() {${truncateForDisplay(formatted)}}`;
          } else {
            return `rejected lazy() {…}`;
          }
        }
      }
      return 'lazy()';
    case 'array_buffer':
      return `ArrayBuffer(${data.byteLength})`;
    case 'data_view':
      return `DataView(${data.buffer.byteLength})`;
    case 'array':
      if (showFormattedValue) {
        let formatted = '';
        for (let i = 0; i < data.length; i++) {
          if (i > 0) {
            formatted += ', ';
          }
          formatted += utils_formatDataForPreview(data[i], false);
          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            break;
          }
        }
        return `[${truncateForDisplay(formatted)}]`;
      } else {
        const length = utils_hasOwnProperty.call(data, meta.size) ? data[meta.size] : data.length;
        return `Array(${length})`;
      }
    case 'typed_array':
      const shortName = `${data.constructor.name}(${data.length})`;
      if (showFormattedValue) {
        let formatted = '';
        for (let i = 0; i < data.length; i++) {
          if (i > 0) {
            formatted += ', ';
          }
          formatted += data[i];
          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            break;
          }
        }
        return `${shortName} [${truncateForDisplay(formatted)}]`;
      } else {
        return shortName;
      }
    case 'iterator':
      const name = data.constructor.name;
      if (showFormattedValue) {
        const array = Array.from(data);
        let formatted = '';
        for (let i = 0; i < array.length; i++) {
          const entryOrEntries = array[i];
          if (i > 0) {
            formatted += ', ';
          }
          if (src_isArray(entryOrEntries)) {
            const key = utils_formatDataForPreview(entryOrEntries[0], true);
            const value = utils_formatDataForPreview(entryOrEntries[1], false);
            formatted += `${key} => ${value}`;
          } else {
            formatted += utils_formatDataForPreview(entryOrEntries, false);
          }
          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            break;
          }
        }
        return `${name}(${data.size}) {${truncateForDisplay(formatted)}}`;
      } else {
        return `${name}(${data.size})`;
      }
    case 'opaque_iterator':
      {
        return data[Symbol.toStringTag];
      }
    case 'date':
      return data.toString();
    case 'class_instance':
      try {
        let resolvedConstructorName = data.constructor.name;
        if (typeof resolvedConstructorName === 'string') {
          return resolvedConstructorName;
        }
        resolvedConstructorName = Object.getPrototypeOf(data).constructor.name;
        if (typeof resolvedConstructorName === 'string') {
          return resolvedConstructorName;
        }
        try {
          return truncateForDisplay(String(data));
        } catch (error) {
          return 'unserializable';
        }
      } catch (error) {
        return 'unserializable';
      }
    case 'thenable':
      let displayName;
      if (isPlainObject(data)) {
        displayName = 'Thenable';
      } else {
        let resolvedConstructorName = data.constructor.name;
        if (typeof resolvedConstructorName !== 'string') {
          resolvedConstructorName = Object.getPrototypeOf(data).constructor.name;
        }
        if (typeof resolvedConstructorName === 'string') {
          displayName = resolvedConstructorName;
        } else {
          displayName = 'Thenable';
        }
      }
      switch (data.status) {
        case 'pending':
          return `pending ${displayName}`;
        case 'fulfilled':
          if (showFormattedValue) {
            const formatted = utils_formatDataForPreview(data.value, false);
            return `fulfilled ${displayName} {${truncateForDisplay(formatted)}}`;
          } else {
            return `fulfilled ${displayName} {…}`;
          }
        case 'rejected':
          if (showFormattedValue) {
            const formatted = utils_formatDataForPreview(data.reason, false);
            return `rejected ${displayName} {${truncateForDisplay(formatted)}}`;
          } else {
            return `rejected ${displayName} {…}`;
          }
        default:
          return displayName;
      }
    case 'object':
      if (showFormattedValue) {
        const keys = Array.from(utils_getAllEnumerableKeys(data)).sort(alphaSortKeys);
        let formatted = '';
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (i > 0) {
            formatted += ', ';
          }
          formatted += `${key.toString()}: ${utils_formatDataForPreview(data[key], false)}`;
          if (formatted.length > MAX_PREVIEW_STRING_LENGTH) {
            break;
          }
        }
        return `{${truncateForDisplay(formatted)}}`;
      } else {
        return '{…}';
      }
    case 'error':
      return truncateForDisplay(String(data));
    case 'boolean':
    case 'number':
    case 'infinity':
    case 'nan':
    case 'null':
    case 'undefined':
      return String(data);
    default:
      try {
        return truncateForDisplay(String(data));
      } catch (error) {
        return 'unserializable';
      }
  }
}
const isPlainObject = object => {
  const objectPrototype = Object.getPrototypeOf(object);
  if (!objectPrototype) return true;
  const objectParentPrototype = Object.getPrototypeOf(objectPrototype);
  return !objectParentPrototype;
};
function backendToFrontendSerializedElementMapper(element) {
  const {
    formattedDisplayName,
    hocDisplayNames,
    compiledWithForget
  } = parseElementDisplayNameFromBackend(element.displayName, element.type);
  return {
    ...element,
    displayName: formattedDisplayName,
    hocDisplayNames,
    compiledWithForget
  };
}
function normalizeUrlIfValid(url) {
  try {
    return new URL(url).toString();
  } catch {
    return url;
  }
}
function getIsReloadAndProfileSupported() {
  let isBackendStorageAPISupported = false;
  try {
    localStorage.getItem('test');
    isBackendStorageAPISupported = true;
  } catch (error) {}
  return isBackendStorageAPISupported && isSynchronousXHRSupported();
}
function getIfReloadedAndProfiling() {
  return sessionStorageGetItem(SESSION_STORAGE_RELOAD_AND_PROFILE_KEY) === 'true';
}
function getProfilingSettings() {
  return {
    recordChangeDescriptions: sessionStorageGetItem(SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY) === 'true',
    recordTimeline: sessionStorageGetItem(SESSION_STORAGE_RECORD_TIMELINE_KEY) === 'true'
  };
}
function onReloadAndProfile(recordChangeDescriptions, recordTimeline) {
  sessionStorageSetItem(SESSION_STORAGE_RELOAD_AND_PROFILE_KEY, 'true');
  sessionStorageSetItem(SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY, recordChangeDescriptions ? 'true' : 'false');
  sessionStorageSetItem(SESSION_STORAGE_RECORD_TIMELINE_KEY, recordTimeline ? 'true' : 'false');
}
function onReloadAndProfileFlagsReset() {
  sessionStorageRemoveItem(SESSION_STORAGE_RELOAD_AND_PROFILE_KEY);
  sessionStorageRemoveItem(SESSION_STORAGE_RECORD_CHANGE_DESCRIPTIONS_KEY);
  sessionStorageRemoveItem(SESSION_STORAGE_RECORD_TIMELINE_KEY);
}
function unionOfTwoArrays(a, b) {
  let result = a;
  for (let i = 0; i < b.length; i++) {
    const value = b[i];
    if (a.indexOf(value) === -1) {
      if (result === a) {
        result = a.slice(0);
      }
      result.push(value);
    }
  }
  return result;
}
;// CONCATENATED MODULE: ./src/util/getHookName.js

function formatHookPathValue(value) {
  if (value === undefined) {
    return null;
  }
  return utils_formatDataForPreview(value, true);
}
function getHookName(hook) {
  const formattedHookPathValue = formatHookPathValue(hook.value);
  if (formattedHookPathValue === null) {
    return hook.name;
  }
  return `${hook.name}(${formattedHookPathValue})`;
}
;// CONCATENATED MODULE: ./src/onCommitFiber.js



let isRecording = false;
let changes = [];
let mountedFibersByRoot = new WeakMap();
function getOrCreateMountedFibersForRoot(root) {
  let set = mountedFibersByRoot.get(root);
  if (set === undefined) {
    set = new WeakSet();
    mountedFibersByRoot.set(root, set);
  }
  return set;
}
function snapshotMountedFibers(fiber, set) {
  if (fiber === null) {
    return;
  }
  set.add(fiber);
  snapshotMountedFibers(fiber.child, set);
  snapshotMountedFibers(fiber.sibling, set);
}
function getMemoizedStateConsumption(hook) {
  if (hook.id === null) {
    return 0;
  }
  switch (hook.name) {
    case 'SyncExternalStore':
    case 'Transition':
      return 2;
    case 'ActionState':
    case 'FormState':
      return 3;
    default:
      return 1;
  }
}
function collectHooksByMemoizedStateIndex(tree, path, hooksByMemoizedStateIndex, memoizedStateIndex) {
  for (const hook of tree) {
    if (hook.subHooks.length > 0) {
      const hookName = getHookName(hook);
      memoizedStateIndex = collectHooksByMemoizedStateIndex(hook.subHooks, [...path, hookName], hooksByMemoizedStateIndex, memoizedStateIndex);
      continue;
    }
    const consumption = getMemoizedStateConsumption(hook);
    if (consumption === 0) {
      continue;
    }
    hooksByMemoizedStateIndex.set(memoizedStateIndex, {
      hook,
      path
    });
    memoizedStateIndex += consumption;
  }
  return memoizedStateIndex;
}
function isStatefulHookNode(hook) {
  return hook.isStateEditable === true || hook.name === 'SyncExternalStore' || hook.name === 'Transition' || hook.name === 'ActionState' || hook.name === 'FormState';
}
function getHooksByMemoizedStateIndex(cache, fiber, currentDispatcherRef) {
  const cached = cache.get(fiber);
  if (cached !== undefined && cached.currentDispatcherRef === currentDispatcherRef) {
    return cached.hooksByMemoizedStateIndex;
  }
  let hooksTree = null;
  try {
    hooksTree = inspectHooksOfFiber(fiber, currentDispatcherRef);
  } catch (error) {
    console.error('failed to inpect hook tree', error);
    hooksTree = null;
  }
  let hooksByMemoizedStateIndex;
  if (hooksTree === null) {
    hooksByMemoizedStateIndex = null;
  } else {
    hooksByMemoizedStateIndex = new Map();
    collectHooksByMemoizedStateIndex(hooksTree, [], hooksByMemoizedStateIndex, 0);
  }
  cache.set(fiber, {
    currentDispatcherRef,
    hooksByMemoizedStateIndex
  });
  return hooksByMemoizedStateIndex;
}
function flushCommit() {
  const flushed = [];
  const hookResolutionCache = new Map();
  for (const commitRecord of changes) {
    const {
      changes: commitChanges,
      currentDispatcherRef
    } = commitRecord;
    const nextCommitChanges = [];
    for (const change of commitChanges) {
      const hookIndices = change.hooks;
      if (hookIndices == null || hookIndices.length === 0) {
        nextCommitChanges.push(change);
        continue;
      }
      const hooksByMemoizedStateIndex = getHooksByMemoizedStateIndex(hookResolutionCache, change.fiber, currentDispatcherRef);
      if (hooksByMemoizedStateIndex === null) {
        nextCommitChanges.push(change);
        console.error('react-devtools-custom: failed to build hook index for fiber %o', change.fiber);
        continue;
      }
      const resolvedHooks = [];
      for (const hookIndex of hookIndices) {
        const resolvedHook = hooksByMemoizedStateIndex.get(hookIndex.hookIndex);
        if (resolvedHook === undefined) {
          console.error('react-devtools-custom: no hook found at fiber memoizedState index %s for fiber %o', hookIndex.hookIndex, change.fiber);
          continue;
        }
        if (!isStatefulHookNode(resolvedHook.hook)) {
          continue;
        }
        resolvedHooks.push({
          hookIndex: resolvedHook.hook.id,
          hookName: resolvedHook.hook.name,
          hookPath: [...resolvedHook.path, resolvedHook.hook.name],
          hookSource: resolvedHook.hook.hookSource,
          prev: hookIndex.prev,
          next: hookIndex.next
        });
      }
      nextCommitChanges.push({
        ...change,
        didHooksChange: resolvedHooks.length > 0,
        hooks: resolvedHooks
      });
    }
    flushed.push(nextCommitChanges);
  }
  return flushed;
}
function startRecording(rootOrRoots) {
  mountedFibersByRoot = new WeakMap();
  const roots = Array.isArray(rootOrRoots) ? rootOrRoots : [rootOrRoots];
  roots.forEach(root => {
    if (root != null && root.current != null) {
      const set = getOrCreateMountedFibersForRoot(root);
      snapshotMountedFibers(root.current, set);
    }
  });
  isRecording = true;
  changes = [];
}
function endRecording() {
  isRecording = false;
  const recorded = flushCommit();
  changes = [];
  mountedFibersByRoot = new WeakMap();
  return recorded;
}
function onCommitFiber(root, currentDispatcherRef) {
  if (!isRecording) {
    return [];
  }
  if (root.current == null || root.current.child == null) {
    return [];
  }
  const commitChanges = [];
  const mountedFibers = getOrCreateMountedFibersForRoot(root);
  collectFiberChanges(root.current, commitChanges, mountedFibers);
  changes.push({
    changes: commitChanges,
    currentDispatcherRef
  });
  return commitChanges;
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