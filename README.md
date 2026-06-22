# use-fields

Typed field setters and resets for grouped local React state.

`useFields` is a small React hook for local UI state that belongs together. It
keeps related fields in one object, gives you readable field-level setters like
`set.query(...)`, and makes reset behavior simple.

It is not a form library. It is not global state. It is not trying to replace
`useReducer`. It is a tiny, strict helper for grouped local state.

```tsx
import { useFields } from "@yatiyo/use-fields";

const [state, set, reset] = useFields({
  query: "",
  page: 1,
  isOpen: false,
});

set.query("react");
set.page((page) => page + 1);
reset.query();
reset();
```

## Why?

`useState` is already a great primitive. But in search panels, filters, modals,
drawers, pagination, and small form-like UI state, setter and reset code can get
repetitive quickly.

`useFields` keeps that flow compact:

- Keep related local state fields in one place.
- Update one field with `set.query(...)`.
- Reset one field with `reset.query()`.
- Reset everything with `reset()`.
- Apply top-level patch updates when useful.
- Get TypeScript autocomplete from the initial state.

## Before / After

### Before

```tsx
function SearchPanel() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const resetAll = () => {
    setQuery("");
    setPage(1);
    setIsOpen(false);
    setSelectedId(null);
  };

  return (
    <>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <button onClick={() => setPage((page) => page + 1)}>
        Next page
      </button>

      <button onClick={() => setQuery("")}>
        Clear search
      </button>

      <button onClick={resetAll}>
        Reset all
      </button>
    </>
  );
}
```

### After

```tsx
function SearchPanel() {
  const [state, set, reset] = useFields({
    query: "",
    page: 1,
    isOpen: false,
    selectedId: null as string | null,
  });

  return (
    <>
      <input
        value={state.query}
        onChange={(event) => set.query(event.target.value)}
      />

      <button onClick={() => set.page((page) => page + 1)}>
        Next page
      </button>

      <button onClick={() => reset.query()}>
        Clear search
      </button>

      <button onClick={() => reset()}>
        Reset all
      </button>
    </>
  );
}
```

## Installation

```bash
npm install @yatiyo/use-fields
```

React 18 and React 19 are supported through the peer dependency range. The hook
only uses stable React APIs: `useState` and `useRef`.

## API

```tsx
const [state, set, reset] = useFields(initialState);
```

### `state`

The current state object.

```tsx
state.query;
state.page;
state.isOpen;
```

### `set.field(value)`

Updates one field.

```tsx
set.query("react");
set.page(2);
set.isOpen(true);
```

### `set.field(updater)`

Updates one field from its previous value.

```tsx
set.page((page) => page + 1);
set.query((query) => query.trim());
```

The `previous` value passed to the updater is readonly at the TypeScript level.
At runtime, the updater receives a cloned snapshot instead of the current state
reference.

### `set(patch)`

Applies a top-level object patch.

```tsx
set({
  query: "react",
  page: 1,
});
```

Patch updates only merge top-level fields.

### `set(updater)`

Creates a top-level patch from the previous state.

```tsx
set((previous) => ({
  query: previous.query.trim(),
  page: previous.page + 1,
}));
```

### `reset.field()`

Resets one field to its initial value.

```tsx
reset.query();
reset.page();
```

### `reset()`

Resets every field to the initial snapshot.

```tsx
reset();
```

## Nested Objects

Nested objects are not deep-merged. The field is replaced.

```tsx
const [state, set] = useFields({
  user: {
    name: "",
    age: 0,
  },
});
```

Use a field updater for partial nested changes:

```tsx
set.user((user) => ({
  ...user,
  name: "Ada",
}));
```

This tries to replace the whole `user` object, and TypeScript can catch the
missing field:

```tsx
set.user({
  name: "Ada",
});
```

## Optional Fields

Use an explicit `undefined` union instead of a top-level optional property.

```tsx
const [state, set, reset] = useFields({
  selectedId: undefined as string | undefined,
});

set.selectedId("user_123");
set.selectedId(undefined);
reset.selectedId();
```

## Supported Values

`useFields` is designed for plain local UI state.

Supported values:

- Primitive values: `string`, `number`, `boolean`, `null`, `undefined`,
  `bigint`, and symbol values.
- Plain arrays.
- Plain objects.
- Nested plain arrays and plain objects.

Example:

```tsx
useFields({
  query: "",
  page: 1,
  isOpen: false,
  selectedId: null as string | null,
  tags: ["react", "typescript"],
  filters: {
    sort: "newest",
    visible: true,
  },
});
```

Unsupported values and shapes:

- `Date`
- `Map`
- `Set`
- Function values
- Class instances
- Custom-prototype objects
- Symbol keys
- Sparse arrays
- Accessor properties
- Non-enumerable properties
- Reserved keys: `__proto__`, `constructor`, `prototype`

## Object Identity

Object and array values are cloned when they are written to state and when they
are reset. This prevents outside references from silently mutating your state.

Because of that, do not rely on object identity:

```tsx
const user = { name: "Ada" };

set.user(user);

// After the update renders, the stored value is a clone.
// Do not rely on this:
// state.user === user
```

Use state immutably, just like normal React state.

## When To Use It

- Search state.
- Filter state.
- Pagination state.
- Modal or drawer state.
- Selection state.
- Small form-like local state.
- Local UI state that needs reset behavior.

## When Not To Use It

- Global app state.
- Server state.
- Complex state transitions.
- State machine flows.
- Large nested objects.
- Large arrays.
- Large forms that need validation, touched, dirty, errors, and submit state.
- Cases where one `useState` is already clearer.

For complex forms, use a form library. For complex state transitions, `useReducer`
or a state machine may be a better fit. For shared app state, use a global state
tool.

## Notes

- `initialState` is captured as a snapshot on the first mount.
- `reset()` returns to the initial snapshot.
- `reset.field()` resets one field to its initial value.
- Patch updates are top-level only.
- Nested object fields are replaced, not deep-merged.
- Object and array values are cloned on write and reset.
- State should be treated as immutable.
- The package is built for small local UI state.

## License

MIT
