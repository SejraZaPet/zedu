export interface PresentationEditorPreferences {
  leftPanelOpen: boolean;
  propertiesOpen: boolean;
  thumbnailsOpen: boolean;
}

export const DEFAULT_PRESENTATION_EDITOR_PREFERENCES: PresentationEditorPreferences = {
  leftPanelOpen: true,
  propertiesOpen: true,
  thumbnailsOpen: true,
};

const STORAGE_KEY = "bezli:presentation-editor-layout:v1";

export function loadPresentationEditorPreferences(storage?: Pick<Storage, "getItem"> | null, viewportWidth?: number): PresentationEditorPreferences {
  const defaults = viewportWidth !== undefined && viewportWidth <= 1100
    ? { ...DEFAULT_PRESENTATION_EDITOR_PREFERENCES, leftPanelOpen: false, propertiesOpen: false }
    : DEFAULT_PRESENTATION_EDITOR_PREFERENCES;
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const value = JSON.parse(raw) as Partial<PresentationEditorPreferences>;
    return {
      leftPanelOpen: typeof value.leftPanelOpen === "boolean" ? value.leftPanelOpen : defaults.leftPanelOpen,
      propertiesOpen: typeof value.propertiesOpen === "boolean" ? value.propertiesOpen : defaults.propertiesOpen,
      thumbnailsOpen: typeof value.thumbnailsOpen === "boolean" ? value.thumbnailsOpen : defaults.thumbnailsOpen,
    };
  } catch {
    return defaults;
  }
}

export function savePresentationEditorPreferences(
  value: PresentationEditorPreferences,
  storage?: Pick<Storage, "setItem"> | null,
) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Editor zůstane plně funkční i v režimu bez dostupného lokálního úložiště.
  }
}
