import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState } from "react";
import { useValueHistory } from "../useSlidesHistory";

const useHarness = () => {
  const [value, setValue] = useState<number[]>([1]);
  const history = useValueHistory(value, setValue);
  return { value, setValue, history };
};

describe("useValueHistory", () => {
  it("vrátí předchozí i následující stav", async () => {
    const { result } = renderHook(useHarness);
    expect(result.current.history.canUndo).toBe(false);

    await act(async () => {
      result.current.setValue([1, 2]);
      await new Promise((r) => setTimeout(r, 500));
    });
    await act(async () => {
      result.current.setValue([1, 2, 3]);
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(result.current.history.canUndo).toBe(true);

    await act(async () => result.current.history.undo());
    expect(result.current.value).toEqual([1, 2]);

    await act(async () => result.current.history.undo());
    expect(result.current.value).toEqual([1]);
    expect(result.current.history.canUndo).toBe(false);

    await act(async () => result.current.history.redo());
    expect(result.current.value).toEqual([1, 2]);
  });

  it("po undo zaznamená novou změnu jako nový krok", async () => {
    const { result } = renderHook(useHarness);
    await act(async () => {
      result.current.setValue([1, 2]);
      await new Promise((r) => setTimeout(r, 500));
    });
    await act(async () => result.current.history.undo());
    await act(async () => {
      result.current.setValue([9]);
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(result.current.history.canUndo).toBe(true);
    await act(async () => result.current.history.undo());
    expect(result.current.value).toEqual([1]);
  });
});
