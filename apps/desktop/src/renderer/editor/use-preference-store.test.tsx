// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePreferenceStore } from "./use-preference-store.js";

type Prefs = { readonly favourites: readonly string[] };

describe("usePreferenceStore", () => {
  it("follows the preferences it's given, without reporting them back", () => {
    const onChange = vi.fn();
    const first: Prefs = { favourites: [] };
    const { result, rerender } = renderHook(({ given }) => usePreferenceStore(given, onChange), {
      initialProps: { given: first },
    });
    const store = result.current;
    expect(store.getState()).toBe(first);

    const next: Prefs = { favourites: ["Hero"] };
    rerender({ given: next });

    expect(result.current).toBe(store);
    expect(store.getState()).toBe(next);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports the panel's own changes to the latest onChange", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const given: Prefs = { favourites: [] };
    const { result, rerender } = renderHook(({ onChange }) => usePreferenceStore(given, onChange), {
      initialProps: { onChange: first },
    });
    rerender({ onChange: latest });

    act(() => result.current.setState({ favourites: ["Faq"] }));

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith({ favourites: ["Faq"] });
  });
});
