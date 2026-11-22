import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PRESENTATION_EDITOR_PREFERENCES, loadPresentationEditorPreferences, savePresentationEditorPreferences } from "@/lib/presentation-editor-preferences";

describe("pamatované rozvržení editoru", () => {
  it("uloží a znovu načte sbalení obou panelů a miniatur", () => {
    const storage = { getItem: vi.fn(() => JSON.stringify({ leftPanelOpen: false, propertiesOpen: false, thumbnailsOpen: false })), setItem: vi.fn() };
    const value = loadPresentationEditorPreferences(storage);
    expect(value).toEqual({ leftPanelOpen: false, propertiesOpen: false, thumbnailsOpen: false });
    savePresentationEditorPreferences(value, storage);
    expect(storage.setItem).toHaveBeenCalledWith("bezli:presentation-editor-layout:v1", JSON.stringify(value));
  });

  it("na tabletu při první návštěvě nechá celé plátno a uctí pozdější volbu", () => {
    expect(loadPresentationEditorPreferences({ getItem: () => null }, 1024)).toEqual({ leftPanelOpen: false, propertiesOpen: false, thumbnailsOpen: true });
    expect(loadPresentationEditorPreferences({ getItem: () => JSON.stringify({ leftPanelOpen: true, propertiesOpen: true, thumbnailsOpen: false }) }, 1024)).toEqual({ leftPanelOpen: true, propertiesOpen: true, thumbnailsOpen: false });
  });

  it("poškozená nebo neúplná volba nerozbije editor", () => {
    expect(loadPresentationEditorPreferences({ getItem: () => "neplatný JSON" })).toEqual(DEFAULT_PRESENTATION_EDITOR_PREFERENCES);
    expect(loadPresentationEditorPreferences({ getItem: () => JSON.stringify({ thumbnailsOpen: false }) })).toEqual({ leftPanelOpen: true, propertiesOpen: true, thumbnailsOpen: false });
    expect(() => savePresentationEditorPreferences(DEFAULT_PRESENTATION_EDITOR_PREFERENCES, { setItem: () => { throw new Error("storage disabled"); } })).not.toThrow();
  });
});
