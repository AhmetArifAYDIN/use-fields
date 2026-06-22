import { useFields } from "../src";
import type { Patch, PatchUpdater } from "../src";

interface SearchState {
  filters: {
    query: string;
    tags: string[];
  };
  isOpen: boolean;
  page: number;
}

const initialFromInterface: SearchState = {
  filters: {
    query: "",
    tags: ["vip"],
  },
  isOpen: false,
  page: 1,
};

const [interfaceState, interfaceSet] = useFields(initialFromInterface);

interfaceSet.page(2);
interfaceState.filters.query satisfies string;

const reusablePatch: Patch<SearchState> = { page: 2 };
const reusablePatchUpdater: PatchUpdater<SearchState> = (previous) => ({
  page: previous.page + 1,
});

interfaceSet(reusablePatch);
interfaceSet(reusablePatchUpdater);

const [, optionalSet] = useFields({
  selectedId: undefined as string | undefined,
});

optionalSet.selectedId("user-1");
optionalSet.selectedId(undefined);
optionalSet({ selectedId: undefined });
optionalSet(() => ({ selectedId: undefined }));

// @ts-expect-error top-level optional fields must be initialized explicitly
useFields({} as { selectedId?: string });

const secretKey = Symbol("secret");

// @ts-expect-error symbol keys are not supported
useFields({
  [secretKey]: "hidden",
  query: "",
});

// @ts-expect-error reserved keys are not supported
useFields({
  constructor: "",
  query: "",
});

useFields({
  // @ts-expect-error nested reserved keys are not supported
  filters: {
    prototype: "",
    query: "",
  },
});

const [state, set, reset] = useFields({
  filters: {
    query: "",
    tags: ["vip"],
  },
  isOpen: false,
  page: 1,
});

set.page(2);
set.isOpen(true);
set.filters({
  query: "react",
  tags: ["vip", "new"],
});
set.filters((previous) => ({
  query: previous.query.trim(),
  tags: [...previous.tags, "new"],
}));

reset.page();
reset();

state.page satisfies number;
state.isOpen satisfies boolean;

// @ts-expect-error page expects a number
set.page("two");

// @ts-expect-error patch values must match the field type
set({ page: undefined });

// @ts-expect-error patch updater values must match the field type
set(() => ({ page: undefined }));

set.filters((previous) => {
  // @ts-expect-error updater previous values are readonly
  previous.query = "mutated";

  return {
    query: previous.query,
    tags: [...previous.tags],
  };
});

set((previous) => {
  // @ts-expect-error patch updater previous values are deeply readonly
  previous.filters.tags.push("mutated");

  return {};
});

useFields({
  // @ts-expect-error function-valued top-level fields are not supported
  onSubmit: () => {},
});
