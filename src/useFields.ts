import { useRef, useState } from "react";

// Public state shape
type Primitive = bigint | boolean | null | number | string | symbol | undefined;

// Type helpers
type IsUnion<T, U = T> = T extends T ? ([U] extends [T] ? false : true) : never;

type WidenLiteral<T, TWide> = TWide extends T
  ? T
  : IsUnion<T> extends true
    ? T
    : TWide;

type NormalizePrimitive<T> =
  [T] extends [string]
    ? WidenLiteral<T, string>
    : [T] extends [number]
      ? WidenLiteral<T, number>
      : [T] extends [boolean]
        ? WidenLiteral<T, boolean>
        : [T] extends [bigint]
          ? WidenLiteral<T, bigint>
          : [T] extends [symbol]
            ? WidenLiteral<T, symbol>
            : T;

type NormalizeFieldValue<T> =
  [T] extends [Primitive]
    ? NormalizePrimitive<T>
    : [T] extends [readonly (infer U)[]]
      ? NormalizeFieldValue<U>[]
      : [T] extends [object]
        ? {
            [K in keyof T]: NormalizeFieldValue<T[K]>;
          }
        : never;

type NormalizeState<T extends object> = {
  [K in keyof T]: NormalizeFieldValue<T[K]>;
};

type DeepReadonlyValue<T> =
  T extends Primitive
    ? T
    : T extends readonly (infer U)[]
      ? ReadonlyArray<DeepReadonlyValue<U>>
      : T extends object
        ? {
            readonly [K in keyof T]: DeepReadonlyValue<T[K]>;
          }
        : T;

type DeepReadonlyState<T extends object> = {
  readonly [K in keyof T]: DeepReadonlyValue<T[K]>;
};

type ReservedFieldKey = "__proto__" | "constructor" | "prototype";

type UnsupportedObjectKeys<T extends object> =
  | Extract<keyof T, ReservedFieldKey>
  | Extract<keyof T, symbol>;

type SupportedObjectValue<T extends object> =
  UnsupportedObjectKeys<T> extends never
    ? {
        [K in keyof T]: SupportedFieldValue<T[K]>;
      }
    : never;

type SupportedFieldValue<T> =
  T extends Primitive
    ? T
    : T extends (...args: any[]) => unknown
      ? never
      : T extends readonly (infer U)[]
        ? SupportedFieldValue<U>[]
        : T extends object
          ? SupportedObjectValue<T>
          : never;

type OptionalKeys<T extends object> = {
  [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? K : never;
}[keyof T];

type SupportedFieldsState<T extends object> =
  T extends readonly unknown[]
    ? never
    : T extends (...args: any[]) => unknown
      ? never
      : UnsupportedObjectKeys<T> extends never
        ? OptionalKeys<T> extends never
          ? SupportedObjectValue<T>
          : never
        : never;

type SupportedInitialState<T extends object> = T & SupportedFieldsState<T>;

export type FieldValue =
  | Primitive
  | FieldValue[]
  | {
      [key: string]: FieldValue;
    };

export type FieldsState = Record<string, FieldValue>;
export type ValueOrUpdater<T> = T | ((previous: DeepReadonlyValue<T>) => T);

export type Patch<T extends object> = Partial<{
  [K in keyof T]: T[K];
}>;

type IsBroadPatch<T extends object, TPatch extends Patch<T>> =
  [Patch<T>] extends [TPatch] ? true : false;

type StrictPatchValue<T extends object, TPatch extends Patch<T>, K> =
  IsBroadPatch<T, TPatch> extends true
    ? TPatch[K & keyof TPatch]
    : K extends keyof T
      ? undefined extends TPatch[K]
        ? undefined extends T[K]
          ? TPatch[K]
          : never
        : TPatch[K]
      : never;

type StrictPatch<T extends object, TPatch extends Patch<T>> = TPatch & {
  [K in keyof TPatch]: StrictPatchValue<T, TPatch, K>;
};

export type PatchUpdater<T extends object> = (
  previous: DeepReadonlyState<T>,
) => Patch<T>;

export type FieldSetters<T extends object> = {
  [K in keyof T]: (value: ValueOrUpdater<T[K]>) => void;
};

export type FieldResetters<T extends object> = {
  [K in keyof T]: () => void;
};

export type SetFields<T extends object> = FieldSetters<T> & {
  <TPatch extends Patch<T>>(patch: StrictPatch<T, TPatch>): void;
  <TPatch extends Patch<T>>(
    patchUpdater: (previous: DeepReadonlyState<T>) => StrictPatch<T, TPatch>,
  ): void;
};

export type ResetFields<T extends object> = FieldResetters<T> & (() => void);

export type UseFieldsReturn<T extends object> = [
  state: T,
  set: SetFields<T>,
  reset: ResetFields<T>,
];

type FieldsStore<T extends object> = {
  initialSnapshot: T;
  state: T;
};

type StateSetter<T extends object> = (updater: (previous: T) => T) => void;
type AnyFunction = (...args: any[]) => unknown;

type FieldKey<T extends object> = Extract<keyof T, string>;
type FieldApiCache<TValue> = Map<string, TValue>;
const RESERVED_FIELD_KEYS = new Set<string>([
  "__proto__",
  "constructor",
  "prototype",
]);

function isUpdaterFunction<T>(
  value: ValueOrUpdater<T>,
): value is (previous: DeepReadonlyValue<T>) => T {
  return typeof value === "function";
}

function resolveInitialState<T extends object>(
  initialState: T | (() => T),
): T {
  return isUpdaterFunction(initialState)
    ? (initialState as () => T)()
    : initialState;
}

// Runtime validation
function isPlainObject(value: unknown): value is FieldsState {
  if (Object.prototype.toString.call(value) !== "[object Object]") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype;
}

function isPlainArray(value: unknown): value is FieldValue[] {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
}

function assertPlainObject(value: unknown): asserts value is FieldsState {
  if (!isPlainObject(value)) {
    throw new Error(
      "useFields only supports plain object state. Pass a plain object like { query: '', page: 1 }.",
    );
  }
}

function assertSafeFieldKey(key: string, keyPath: string): void {
  if (RESERVED_FIELD_KEYS.has(key)) {
    throw new Error(
      `useFields does not allow reserved key "${keyPath}". Choose a different field name.`,
    );
  }
}

function createKeyPath(parentPath: string, key: string): string {
  return parentPath ? `${parentPath}.${key}` : key;
}

function getPlainObjectEntries(
  value: FieldsState,
  keyPath: string,
): Array<[string, FieldValue]> {
  const entries: Array<[string, FieldValue]> = [];

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      throw new Error(
        `useFields does not support symbol key "${String(key)}" in "${keyPath || "state"}". Use string field names.`,
      );
    }

    const nestedKeyPath = createKeyPath(keyPath, key);
    assertSafeFieldKey(key, nestedKeyPath);

    const descriptor = Object.getOwnPropertyDescriptor(value, key);

    if (!descriptor?.enumerable) {
      throw new Error(
        `useFields does not support non-enumerable key "${nestedKeyPath}". Use plain enumerable object fields.`,
      );
    }

    if (!("value" in descriptor)) {
      throw new Error(
        `useFields does not support accessor key "${nestedKeyPath}". Use plain data properties.`,
      );
    }

    entries.push([key, descriptor.value as FieldValue]);
  }

  return entries;
}

function isArrayIndexKey(key: string): boolean {
  const index = Number(key);

  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < 2 ** 32 - 1 &&
    String(index) === key
  );
}

function getArrayItems(value: FieldValue[], keyPath: string): FieldValue[] {
  const path = keyPath || "array";

  for (const key of Reflect.ownKeys(value)) {
    if (key === "length") {
      continue;
    }

    if (typeof key !== "string") {
      throw new Error(
        `useFields does not support symbol key "${String(key)}" in "${path}". Use plain arrays.`,
      );
    }

    if (!isArrayIndexKey(key)) {
      throw new Error(
        `useFields does not support custom array key "${createKeyPath(path, key)}". Use plain arrays.`,
      );
    }
  }

  return Array.from({ length: value.length }, (_, index) => {
    const indexKey = String(index);
    const itemPath = `${path}[${index}]`;
    const descriptor = Object.getOwnPropertyDescriptor(value, indexKey);

    if (!descriptor) {
      throw new Error(
        `useFields does not support sparse array item "${itemPath}". Use explicit undefined values instead.`,
      );
    }

    if (!descriptor.enumerable) {
      throw new Error(
        `useFields does not support non-enumerable array item "${itemPath}". Use plain arrays.`,
      );
    }

    if (!("value" in descriptor)) {
      throw new Error(
        `useFields does not support accessor array item "${itemPath}". Use plain data values.`,
      );
    }

    return descriptor.value as FieldValue;
  });
}

function isPrimitive(value: unknown): value is Primitive {
  return (
    value === null ||
    typeof value === "bigint" ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "symbol" ||
    typeof value === "undefined"
  );
}

function assertSupportedFieldValue(
  value: unknown,
  keyPath: string,
): asserts value is FieldValue {
  if (isPrimitive(value)) {
    return;
  }

  if (Array.isArray(value)) {
    if (!isPlainArray(value)) {
      throw new Error(
        `useFields does not support "${keyPath}" because its value is not a plain array.`,
      );
    }

    getArrayItems(value, keyPath).forEach((item, index) => {
      assertSupportedFieldValue(item, `${keyPath}[${index}]`);
    });
    return;
  }

  if (isPlainObject(value)) {
    for (const [key, nestedValue] of getPlainObjectEntries(value, keyPath)) {
      const nestedKeyPath = createKeyPath(keyPath, key);
      assertSupportedFieldValue(nestedValue, nestedKeyPath);
    }

    return;
  }

  throw new Error(
    `useFields does not support "${keyPath}" because its value is not a supported plain state value.`,
  );
}

function assertSupportedState(value: unknown): asserts value is FieldsState {
  assertPlainObject(value);

  for (const [key, fieldValue] of getPlainObjectEntries(value, "")) {
    assertSupportedFieldValue(fieldValue, key);
  }
}

// Cloning
function defineSafeProperty<T extends object>(
  target: T,
  key: string,
  value: FieldValue,
): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function deepCloneValue<T extends FieldValue>(value: T): T {
  if (isPrimitive(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return getArrayItems(value, "").map((item) => deepCloneValue(item)) as T;
  }

  const clone: Record<string, FieldValue> = {};

  for (const [key, nestedValue] of getPlainObjectEntries(value, "")) {
    defineSafeProperty(clone, key, deepCloneValue(nestedValue));
  }

  return clone as T;
}

function cloneState<T extends object>(state: T): T {
  return deepCloneValue(state as FieldValue) as T;
}

function getFieldKeys<T extends object>(state: T): Array<keyof T> {
  return Object.keys(state) as Array<keyof T>;
}

// State transitions
function resolveValue<T>(valueOrUpdater: ValueOrUpdater<T>, previous: T): T {
  return isUpdaterFunction(valueOrUpdater)
    ? valueOrUpdater(cloneStateValue(previous) as DeepReadonlyValue<T>)
    : valueOrUpdater;
}

function resolvePatch<T extends object>(
  patchOrUpdater: Patch<T> | PatchUpdater<T>,
  previous: T,
): Patch<T> {
  return typeof patchOrUpdater === "function"
    ? patchOrUpdater(cloneState(previous) as DeepReadonlyState<T>)
    : patchOrUpdater;
}

function assertPlainObjectPatch<T extends object>(
  patch: Patch<T>,
): asserts patch is Patch<T> & FieldsState {
  if (!isPlainObject(patch)) {
    throw new Error(
      "useFields only supports plain object patches. Pass an object like { query: 'react' }.",
    );
  }
}

function cloneStateValue<T>(value: T): T {
  return isPrimitive(value) ? value : (deepCloneValue(value as FieldValue) as T);
}

function mergePatch<T extends object>(previous: T, patch: Patch<T>): T {
  const keys = getFieldKeys(patch);

  if (keys.length === 0) {
    return previous;
  }

  let changed = false;
  const next = { ...previous };

  for (const key of keys) {
    const value = patch[key];

    if (Object.is(previous[key], value)) {
      continue;
    }

    changed = true;
    next[key] = cloneStateValue(value) as T[keyof T];
  }

  return changed ? next : previous;
}

function updateField<T extends object, K extends keyof T>(
  previous: T,
  key: K,
  nextValue: T[K],
): T {
  if (Object.is(previous[key], nextValue)) {
    return previous;
  }

  return {
    ...previous,
    [key]: cloneStateValue(nextValue),
  };
}

function resetAllFields<T extends object>(previous: T, initialState: T): T {
  for (const key of getFieldKeys(initialState)) {
    if (!Object.is(previous[key], initialState[key])) {
      return cloneState(initialState);
    }
  }

  return previous;
}

// Field API creation
function createCachedFieldProxy<TApi extends AnyFunction, TValue>(
  target: TApi,
  validKeys: Set<string>,
  cache: FieldApiCache<TValue>,
  createValue: (key: string) => TValue,
): TApi {
  return new Proxy(target, {
    apply(proxyTarget, thisArg, argumentsList) {
      return Reflect.apply(proxyTarget, thisArg, argumentsList);
    },
    get(proxyTarget, property, receiver) {
      if (typeof property !== "string" || !validKeys.has(property)) {
        return Reflect.get(proxyTarget, property, receiver);
      }

      const cachedValue = cache.get(property);

      if (cachedValue) {
        return cachedValue;
      }

      const nextValue = createValue(property);
      cache.set(property, nextValue);

      return nextValue;
    },
  });
}

function createInitialSnapshot<T extends object>(
  initialState: T | (() => T),
): NormalizeState<SupportedFieldsState<T>> {
  const resolvedState = resolveInitialState(initialState);
  assertSupportedState(resolvedState);

  return cloneState(resolvedState) as NormalizeState<SupportedFieldsState<T>>;
}

function createFieldsStore<T extends object>(
  initialState: T | (() => T),
): FieldsStore<NormalizeState<SupportedFieldsState<T>>> {
  const initialSnapshot = createInitialSnapshot(initialState);

  return {
    initialSnapshot,
    state: cloneState(initialSnapshot),
  };
}

function assertValidPatch<T extends object>(
  patch: Patch<T>,
  allowedKeys: Set<string>,
): void {
  assertPlainObjectPatch(patch);

  for (const [key, value] of getPlainObjectEntries(patch, "")) {
    if (!allowedKeys.has(key)) {
      throw new Error(
        `useFields cannot update unknown field "${key}". Only fields from the initial state can be updated.`,
      );
    }

    assertSupportedFieldValue(value, key);
  }
}

function createSetFields<T extends object>(
  keys: Array<keyof T>,
  setState: StateSetter<T>,
): SetFields<T> {
  const stateKeys = new Set(keys as Array<FieldKey<T>>);
  const setterCache = new Map<FieldKey<T>, FieldSetters<T>[FieldKey<T>]>();

  const setFields = (patchOrUpdater: Patch<T> | PatchUpdater<T>): void => {
    setState((previous) => {
      const patch = resolvePatch(patchOrUpdater, previous);
      assertValidPatch(patch, stateKeys);
      return mergePatch(previous, patch);
    });
  };

  return createCachedFieldProxy(
    setFields,
    stateKeys,
    setterCache,
    (property) => {
      const key = property as FieldKey<T>;

      return ((valueOrUpdater: ValueOrUpdater<T[typeof key]>) => {
        setState((previous) => {
          const nextValue = resolveValue(valueOrUpdater, previous[key]);
          assertSupportedFieldValue(nextValue, key);

          return updateField(previous, key, nextValue);
        });
      }) as FieldSetters<T>[typeof key];
    },
  ) as SetFields<T>;
}

function createResetFields<T extends object>(
  keys: Array<keyof T>,
  initialState: T,
  setState: StateSetter<T>,
): ResetFields<T> {
  const stateKeys = new Set(keys as Array<FieldKey<T>>);
  const resetterCache = new Map<FieldKey<T>, FieldResetters<T>[FieldKey<T>]>();

  const resetFields = (): void => {
    setState((previous) => resetAllFields(previous, initialState));
  };

  return createCachedFieldProxy(
    resetFields,
    stateKeys,
    resetterCache,
    (property) => {
      const key = property as FieldKey<T>;

      return (() => {
        setState((previous) =>
          updateField(
            previous,
            key,
            deepCloneValue(initialState[key] as FieldValue) as T[typeof key],
          ),
        );
      }) as FieldResetters<T>[typeof key];
    },
  ) as ResetFields<T>;
}

export function useFields<T extends object>(
  initialState: SupportedInitialState<T>,
): UseFieldsReturn<NormalizeState<SupportedFieldsState<T>>>;

export function useFields<T extends object>(
  initialState: () => SupportedInitialState<T>,
): UseFieldsReturn<NormalizeState<SupportedFieldsState<T>>>;

export function useFields<T extends object>(
  initialState:
    | SupportedInitialState<T>
    | (() => SupportedInitialState<T>),
): UseFieldsReturn<NormalizeState<SupportedFieldsState<T>>> {
  type State = NormalizeState<SupportedFieldsState<T>>;

  const [store, setStore] = useState<FieldsStore<State>>(() => {
    return createFieldsStore(
      initialState as SupportedFieldsState<T> | (() => SupportedFieldsState<T>),
    ) as unknown as FieldsStore<State>;
  });

  const setRef = useRef<SetFields<State> | undefined>(undefined);
  const resetRef = useRef<ResetFields<State> | undefined>(undefined);
  const setState: StateSetter<State> = (updater) => {
    setStore((previousStore) => {
      const nextState = updater(previousStore.state);

      if (Object.is(previousStore.state, nextState)) {
        return previousStore;
      }

      return {
        ...previousStore,
        state: nextState,
      };
    });
  };

  if (!setRef.current || !resetRef.current) {
    const fieldKeys = getFieldKeys(store.initialSnapshot);

    if (!setRef.current) {
      setRef.current = createSetFields<State>(fieldKeys, setState);
    }

    if (!resetRef.current) {
      resetRef.current = createResetFields<State>(
        fieldKeys,
        store.initialSnapshot,
        setState,
      );
    }
  }

  return [
    store.state,
    setRef.current as SetFields<State>,
    resetRef.current as ResetFields<State>,
  ];
}
