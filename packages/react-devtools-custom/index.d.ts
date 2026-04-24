export type HookSource = {
  lineNumber: number | null;
  columnNumber: number | null;
  fileName: string | null;
  functionName: string | null;
};

export type ComponentFilter = unknown;

export type Handler = (data: unknown) => void;
export type RendererID = number;
export type ReactBuildType =
  | "deadcode"
  | "development"
  | "outdated"
  | "production"
  | "unminified";

export interface DevToolsHookSettings {
  appendComponentStack: boolean;
  breakOnConsoleErrors: boolean;
  disableSecondConsoleLogDimmingInStrictMode: boolean;
  hideConsoleLogsInStrictMode: boolean;
  showInlineWarningsAndErrors: boolean;
}

export interface ProfilingSettings {
  recordChangeDescriptions: boolean;
  recordTimeline: boolean;
}

export interface ReactRenderer {
  ComponentTree?: unknown;
  Mount?: {
    _renderNewRootComponent?: (...args: unknown[]) => unknown;
  };
  bundleType?: number;
  currentDispatcherRef?: unknown;
  findFiberByHostInstance?: unknown;
  getCurrentComponentInfo?: (...args: unknown[]) => unknown;
  getCurrentFiber?: (() => Fiber | null) | null;
  injectProfilingHooks?: (...args: unknown[]) => unknown;
  reconcilerVersion?: string;
  rendererPackageName?: string;
  scheduleRefresh?: Function;
  setErrorHandler?: ((shouldError: (fiber: object) => boolean | null) => void) | null;
  version?: string;
  [key: string]: unknown;
}

export interface ComponentStackMatch {
  componentStack: string;
  enableOwnerStacks: boolean;
}

export interface RendererInterface {
  getComponentStack?: (error: Error) => ComponentStackMatch | null;
  handleCommitFiberRoot?: (root: unknown, priorityLevel?: number) => void;
  handleCommitFiberUnmount?: (fiber: unknown) => void;
  handlePostCommitFiberRoot?: (root: unknown) => void;
  onErrorOrWarning?: (type: "error" | "warn", args: unknown[]) => void;
}

export interface DevToolsBackend {
  [key: string]: unknown;
}

export interface DevToolsHook {
  backends: Map<string, DevToolsBackend>;
  checkDCE: (fn: Function) => void;
  emit: (event: string, data?: unknown) => void;
  getFiberRoots: (rendererID: RendererID) => Set<unknown>;
  getInternalModuleRanges: () => Array<[string, string]>;
  hasUnsupportedRendererAttached: boolean;
  inject: (renderer: ReactRenderer) => number;
  listeners: Record<string, Handler[]>;
  off: (event: string, fn: Handler) => void;
  on: (event: string, fn: Handler) => void;
  onCommitFiberRoot: (
    rendererID: RendererID,
    root: unknown,
    priorityLevel?: number,
  ) => void;
  onCommitFiberUnmount: (rendererID: RendererID, fiber: unknown) => void;
  onPostCommitFiberRoot: (rendererID: RendererID, root: unknown) => void;
  registerInternalModuleStart: (error: Error) => void;
  registerInternalModuleStop: (error: Error) => void;
  rendererInterfaces: Map<RendererID, RendererInterface>;
  renderers: Map<RendererID, ReactRenderer>;
  setStrictMode: (rendererID: RendererID, isStrictMode: boolean) => void;
  settings?: DevToolsHookSettings;
  sub: (event: string, fn: Handler) => () => void;
  supportsFiber: true;
  supportsFlight: true;
}

type ContextDependency = {
  context: unknown;
  memoizedValue: unknown;
  next: ContextDependency | null;
};

type FiberDependencies = {
  firstContext: ContextDependency | null;
} | null;

export type Fiber = {
  alternate: Fiber | null;
  child: Fiber | null;
  dependencies?: FiberDependencies;
  elementType?: unknown;
  effectTag?: number;
  flags?: number;
  memoizedProps: any;
  memoizedState: any;
  ref: unknown;
  return?: Fiber | null;
  sibling: Fiber | null;
  tag: number;
  type: unknown;
  updateQueue?: unknown;
};

export type FiberRoot = {
  current: Fiber | null;
};

// Low-level hook change detected by diffing the prev/next fiber's memoizedState
// linked list. `hookIndex` is the raw position in that list; no hook-tree
// metadata (name/path/source) has been resolved yet. Produced by
// getChangedHooksIndices during commit.
export type DetectedHookChange = {
  hookIndex: number;
  prev: unknown;
  next: unknown;
};

// Hook change after matching a DetectedHookChange against the hook tree from
// inspectHooksOfFiber. `hookIndex` is remapped to the resolved hook-tree index
// (`hook.id`) for the matching slot-consuming hook, and
// hookName/hookPath/hookSource carry the resolved metadata. Produced by
// flushCommit at endRecording time.
export type ResolvedHookChange = {
  hookIndex: number;
  hookName?: string | null;
  hookPath?: Array<string> | null;
  hookSource?: HookSource | null;
  prev: unknown;
  next: unknown;
};

export type ChangeDescription = {
  context: Array<string> | boolean | null;
  didHooksChange: boolean;
  // DetectedHookChange while recording; ResolvedHookChange after flushCommit.
  hooks?: Array<DetectedHookChange | ResolvedHookChange> | null;
  isFirstMount: boolean;
  props: Array<string> | null;
  state: Array<string> | null;
};

export type CommittedFiberChange = {
  // Inclusive render duration for this Fiber in milliseconds, if profiling
  // timings are available for the current React build.
  actualDuration: number | null;
  displayName: string | null;
  fiber: Fiber;
  prevFiber: Fiber | null;
  // Render duration excluding direct child Fibers in milliseconds.
  selfDuration: number | null;
} & ChangeDescription;

export declare function onCommitFiber(
  root: FiberRoot,
  currentDispatcherRef?: unknown,
): Array<CommittedFiberChange>;

export declare function startRecording(): void;

export declare function endRecording(): Array<Array<CommittedFiberChange>>;

export declare function installHook(
  target: any,
  componentFiltersOrComponentFiltersPromise:
    | Array<ComponentFilter>
    | Promise<Array<ComponentFilter>>,
  maybeSettingsOrSettingsPromise?:
    | DevToolsHookSettings
    | Promise<DevToolsHookSettings>,
  shouldStartProfilingNow?: boolean,
  profilingSettings?: ProfilingSettings,
): DevToolsHook | null;
