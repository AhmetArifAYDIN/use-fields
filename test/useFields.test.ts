import { createElement, StrictMode } from "react";
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useFields } from "../src";

describe("useFields", () => {
  it("sets a single field by key", () => {
    const { result } = renderHook(() =>
      useFields({
        query: "",
        page: 1,
        isOpen: false,
      }),
    );

    act(() => {
      result.current[1].query("react");
    });

    expect(result.current[0]).toEqual({
      query: "react",
      page: 1,
      isOpen: false,
    });
  });

  it("supports updater functions like useState", () => {
    const { result } = renderHook(() =>
      useFields({
        query: "  react  ",
        page: 1,
      }),
    );

    act(() => {
      result.current[1].query((query) => query.trim());
      result.current[1].page((page) => page + 1);
    });

    expect(result.current[0]).toEqual({
      query: "react",
      page: 2,
    });
  });

  it("supports object patch updates", () => {
    const { result } = renderHook(() =>
      useFields({
        query: "old",
        page: 3,
        isOpen: true,
      }),
    );

    act(() => {
      result.current[1]({
        query: "new",
        page: 1,
      });
    });

    expect(result.current[0]).toEqual({
      query: "new",
      page: 1,
      isOpen: true,
    });
  });

  it("supports patch updater functions", () => {
    const { result } = renderHook(() =>
      useFields({
        query: "  react  ",
        page: 1,
        isOpen: false,
      }),
    );

    act(() => {
      result.current[1]((previous) => ({
        query: previous.query.trim(),
        page: previous.page + 1,
      }));
    });

    expect(result.current[0]).toEqual({
      query: "react",
      page: 2,
      isOpen: false,
    });
  });

  it("resets a single field to its initial value", () => {
    const { result } = renderHook(() =>
      useFields({
        query: "",
        page: 1,
        isOpen: false,
      }),
    );

    act(() => {
      result.current[1].query("react");
      result.current[1].page(4);
    });

    act(() => {
      result.current[2].query();
    });

    expect(result.current[0]).toEqual({
      query: "",
      page: 4,
      isOpen: false,
    });
  });

  it("resets the whole state to its initial snapshot", () => {
    const { result } = renderHook(() =>
      useFields({
        query: "",
        page: 1,
        isOpen: false,
      }),
    );

    act(() => {
      result.current[1].query("react");
      result.current[1].page(5);
      result.current[1].isOpen(true);
    });

    act(() => {
      result.current[2]();
    });

    expect(result.current[0]).toEqual({
      query: "",
      page: 1,
      isOpen: false,
    });
  });

  it("supports lazy initial state", () => {
    const initializer = vi.fn(() => ({
      query: "",
      page: 1,
    }));

    const { result, rerender } = renderHook(() => useFields(initializer));

    expect(initializer).toHaveBeenCalledTimes(1);
    expect(result.current[0]).toEqual({
      query: "",
      page: 1,
    });

    act(() => {
      result.current[1].page(2);
    });

    rerender();

    expect(initializer).toHaveBeenCalledTimes(1);
    expect(result.current[0]).toEqual({
      query: "",
      page: 2,
    });
  });

  it("keeps lazy initial state and reset snapshot aligned in Strict Mode", () => {
    let nextPage = 1;
    const initializer = vi.fn(() => ({
      page: nextPage++,
    }));
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, null, children);

    const { result } = renderHook(() => useFields(initializer), { wrapper });
    const initialState = result.current[0];

    act(() => {
      result.current[1].page(99);
    });

    act(() => {
      result.current[2]();
    });

    expect(result.current[0]).toEqual(initialState);
  });

  it("throws for non-plain objects", () => {
    expect(() => renderHook(() => useFields(new Date() as never))).toThrow(
      /only supports plain object state/i,
    );
  });

  it("supports state keys like name and length", () => {
    const { result } = renderHook(() =>
      useFields({
        length: 0,
        name: "",
      }),
    );

    act(() => {
      result.current[1].name("Ada");
      result.current[1].length(3);
    });

    expect(result.current[0]).toEqual({
      length: 3,
      name: "Ada",
    });
  });

  it("restores nested values from a safe initial snapshot", () => {
    const { result } = renderHook(() =>
      useFields({
        filters: {
          query: "",
          tags: ["vip"],
        },
      }),
    );

    act(() => {
      result.current[1].filters({
        query: "react",
        tags: ["vip", "new"],
      });
    });

    act(() => {
      result.current[2].filters();
    });

    expect(result.current[0]).toEqual({
      filters: {
        query: "",
        tags: ["vip"],
      },
    });
  });

  it("throws when a patch tries to store unsupported values", () => {
    const { result } = renderHook(() =>
      useFields({
        query: "",
      }),
    );

    expect(() => {
      act(() => {
        result.current[1]({
          query: (() => "nope") as never,
        });
      });
    }).toThrow(/not a supported plain state value/i);
  });

  it("keeps state unchanged when a patch stores unsupported values", () => {
    const { result } = renderHook(() =>
      useFields({
        page: 1,
        query: "",
      }),
    );
    const currentState = result.current[0];

    expect(() => {
      act(() => {
        result.current[1]({
          query: (() => "nope") as never,
        });
      });
    }).toThrow(/not a supported plain state value/i);

    expect(result.current[0]).toBe(currentState);
    expect(result.current[0]).toEqual({
      page: 1,
      query: "",
    });
  });

  it("throws when a patch tries to update an unknown field", () => {
    const { result } = renderHook(() =>
      useFields({
        query: "",
      }),
    );

    expect(() => {
      act(() => {
        result.current[1]({
          other: "x",
        } as never);
      });
    }).toThrow(/cannot update unknown field/i);
  });

  it("keeps state unchanged when a patch updates an unknown field", () => {
    const { result } = renderHook(() =>
      useFields({
        query: "",
      }),
    );
    const currentState = result.current[0];

    expect(() => {
      act(() => {
        result.current[1]({
          other: "x",
        } as never);
      });
    }).toThrow(/cannot update unknown field/i);

    expect(result.current[0]).toBe(currentState);
    expect(result.current[0]).toEqual({
      query: "",
    });
  });

  it("throws for symbol keys in patch objects", () => {
    const secretKey = Symbol("secret");
    const { result } = renderHook(() =>
      useFields({
        query: "",
      }),
    );

    expect(() => {
      act(() => {
        result.current[1]({
          query: "react",
          [secretKey]: "hidden",
        } as never);
      });
    }).toThrow(/symbol key/i);
  });

  it("throws for non-enumerable keys in patch objects", () => {
    const { result } = renderHook(() =>
      useFields({
        query: "",
      }),
    );
    const patch = {};

    Object.defineProperty(patch, "query", {
      enumerable: false,
      value: "react",
    });

    expect(() => {
      act(() => {
        result.current[1](patch as never);
      });
    }).toThrow(/non-enumerable key/i);
  });

  it("throws for reserved keys in initial state", () => {
    const badState = JSON.parse('{ "__proto__": { "x": 1 }, "query": "" }');

    expect(() => renderHook(() => useFields(badState))).toThrow(
      /does not allow reserved key/i,
    );
  });

  it("throws for reserved keys inside nested initial state objects", () => {
    const badState = {
      filters: JSON.parse('{ "__proto__": { "x": 1 }, "query": "" }'),
    };

    expect(() => renderHook(() => useFields(badState as never))).toThrow(
      /filters\.__proto__/i,
    );
  });

  it("throws when a field setter tries to store reserved nested keys", () => {
    const { result } = renderHook(() =>
      useFields({
        filters: {
          query: "",
        },
      }),
    );

    expect(() => {
      act(() => {
        result.current[1].filters(
          JSON.parse('{ "__proto__": { "polluted": true }, "query": "react" }'),
        );
      });
    }).toThrow(/filters\.__proto__/i);
  });

  it("keeps state unchanged when a field setter stores reserved nested keys", () => {
    const { result } = renderHook(() =>
      useFields({
        filters: {
          query: "",
        },
      }),
    );
    const currentState = result.current[0];

    expect(() => {
      act(() => {
        result.current[1].filters(
          JSON.parse('{ "__proto__": { "polluted": true }, "query": "react" }'),
        );
      });
    }).toThrow(/filters\.__proto__/i);

    expect(result.current[0]).toBe(currentState);
    expect(result.current[0]).toEqual({
      filters: {
        query: "",
      },
    });
  });

  it("throws when a patch updater returns a non-plain object", () => {
    const { result } = renderHook(() =>
      useFields({
        query: "",
      }),
    );

    expect(() => {
      act(() => {
        result.current[1](() => new Date() as never);
      });
    }).toThrow(/plain object patches/i);
  });

  it("throws when a patch object is not plain", () => {
    const { result } = renderHook(() =>
      useFields({
        query: "",
      }),
    );

    expect(() => {
      act(() => {
        result.current[1](new Date() as never);
      });
    }).toThrow(/plain object patches/i);
  });

  it("rejects null-prototype objects in state values", () => {
    const filters = Object.create(null) as Record<string, string>;
    filters.query = "";

    expect(() =>
      renderHook(() =>
        useFields({
          filters,
        } as never),
      ),
    ).toThrow(/supported plain state value/i);
  });

  it("throws for symbol keys in initial state", () => {
    const secretKey = Symbol("secret");
    const badState = {
      query: "",
      [secretKey]: "hidden",
    };

    expect(() => renderHook(() => useFields(badState as never))).toThrow(
      /symbol key/i,
    );
  });

  it("throws for non-enumerable keys in initial state", () => {
    const badState = {
      query: "",
    };

    Object.defineProperty(badState, "hidden", {
      enumerable: false,
      value: "secret",
    });

    expect(() => renderHook(() => useFields(badState))).toThrow(
      /non-enumerable key/i,
    );
  });

  it("throws for accessor keys without invoking the getter", () => {
    const getter = vi.fn(() => "");
    const badState = {};

    Object.defineProperty(badState, "query", {
      enumerable: true,
      get: getter,
    });

    expect(() => renderHook(() => useFields(badState as never))).toThrow(
      /accessor key/i,
    );
    expect(getter).not.toHaveBeenCalled();
  });

  it("throws for accessor keys passed through field setters", () => {
    const getter = vi.fn(() => "react");
    const nextFilters = {};
    const { result } = renderHook(() =>
      useFields({
        filters: {
          query: "",
        },
      }),
    );

    Object.defineProperty(nextFilters, "query", {
      enumerable: true,
      get: getter,
    });

    expect(() => {
      act(() => {
        result.current[1].filters(nextFilters as never);
      });
    }).toThrow(/accessor key/i);
    expect(getter).not.toHaveBeenCalled();
  });

  it("throws for custom array keys in initial state", () => {
    const tags = ["vip"] as string[] & { custom?: string };
    tags.custom = "hidden";

    expect(() =>
      renderHook(() =>
        useFields({
          tags,
        }),
      ),
    ).toThrow(/custom array key/i);
  });

  it("throws for sparse arrays in initial state", () => {
    const tags = Array(1) as string[];

    expect(() =>
      renderHook(() =>
        useFields({
          tags,
        }),
      ),
    ).toThrow(/sparse array item/i);
  });

  it("throws for array subclass instances in initial state", () => {
    class Tags extends Array<string> {}

    expect(() =>
      renderHook(() =>
        useFields({
          tags: new Tags("vip"),
        } as never),
      ),
    ).toThrow(/plain array/i);
  });

  it("throws for accessor array items without invoking the getter", () => {
    const getter = vi.fn(() => "vip");
    const tags = [] as string[];

    Object.defineProperty(tags, "0", {
      enumerable: true,
      get: getter,
    });

    expect(() =>
      renderHook(() =>
        useFields({
          tags,
        } as never),
      ),
    ).toThrow(/accessor array item/i);
    expect(getter).not.toHaveBeenCalled();
  });

  it("clones object values passed through field setters", () => {
    const { result } = renderHook(() =>
      useFields({
        filters: {
          query: "",
          tags: ["vip"],
        },
      }),
    );

    const nextFilters = {
      query: "react",
      tags: ["vip", "new"],
    };

    act(() => {
      result.current[1].filters(nextFilters);
    });

    nextFilters.query = "mutated outside";
    nextFilters.tags.push("late-change");

    expect(result.current[0]).toEqual({
      filters: {
        query: "react",
        tags: ["vip", "new"],
      },
    });
  });

  it("clones object values passed through patch updates", () => {
    const { result } = renderHook(() =>
      useFields({
        filters: {
          query: "",
          tags: ["vip"],
        },
      }),
    );

    const nextFilters = {
      query: "react",
      tags: ["vip", "new"],
    };

    act(() => {
      result.current[1]({
        filters: nextFilters,
      });
    });

    nextFilters.query = "mutated outside";
    nextFilters.tags.push("late-change");

    expect(result.current[0]).toEqual({
      filters: {
        query: "react",
        tags: ["vip", "new"],
      },
    });
  });

  it("does not let field updater callbacks mutate the current state reference", () => {
    const { result } = renderHook(() =>
      useFields({
        filters: {
          query: "",
          tags: ["vip"],
        },
        page: 1,
      }),
    );
    const currentFilters = result.current[0].filters;

    act(() => {
      result.current[1].filters((previous) => {
        (previous as { query: string }).query = "mutated inside updater";
        return currentFilters;
      });
    });

    expect(result.current[0].filters).toBe(currentFilters);
    expect(result.current[0].filters).toEqual({
      query: "",
      tags: ["vip"],
    });
  });

  it("does not let patch updater callbacks mutate the current state reference", () => {
    const { result } = renderHook(() =>
      useFields({
        filters: {
          query: "",
          tags: ["vip"],
        },
        page: 1,
      }),
    );
    const currentState = result.current[0];

    act(() => {
      result.current[1]((previous) => {
        (previous as { filters: { query: string } }).filters.query =
          "mutated inside updater";
        return {};
      });
    });

    expect(result.current[0]).toBe(currentState);
    expect(result.current[0]).toEqual({
      filters: {
        query: "",
        tags: ["vip"],
      },
      page: 1,
    });
  });
});
