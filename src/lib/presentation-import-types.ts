export interface PresentationImportSummary {
  slideCount: number;
  textElements: number;
  shapes: number;
  images: number;
  notes: number;
  warnings: string[];
  fallbackUsed?: boolean;
  editableTextLayers?: number;
}

export interface PresentationImportResult {
  slides: Record<string, any>[];
  summary: PresentationImportSummary;
}

export interface PresentationImportProgress {
  current: number;
  total: number;
  message: string;
}
