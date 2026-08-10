import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Crosshair, Trash2, ZoomIn } from "lucide-react";
import SlideCanvas from "@/components/admin/SlideCanvas";
import ZoomZoneSurface from "@/components/live/ZoomZoneSurface";
import { getZoomZones, isZoomableSlide, zoomStageStyle, type ZoomRect, type ZoomZone } from "@/lib/zoom-zones";

interface Props {
  slide: any;
  onChange: (zones: ZoomZone[]) => void;
  darkMode?: boolean;
}

/**
 * Editor for percentage-based zoom zones on a slide. The teacher draws
 * rectangles straight over a 16:9 slide preview (same geometry as projector).
 */
const ZoomZonesEditor = ({ slide, onChange, darkMode = true }: Props) => {
  const zones = getZoomZones(slide);
  const [drawing, setDrawing] = useState(false);
  const [redrawId, setRedrawId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  if (!isZoomableSlide(slide)) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Přiblížení je dostupné jen u výkladových slidů (ne u kvízů a aktivit).
      </p>
    );
  }

  const previewRect: ZoomRect | null = zones.find((z) => z.id === previewId) || null;
  const active = drawing || !!redrawId;

  const handleDraw = (rect: ZoomRect) => {
    if (redrawId) {
      onChange(zones.map((z) => (z.id === redrawId ? { ...z, ...rect } : z)));
      setRedrawId(null);
    } else {
      onChange([
        ...zones,
        { id: `zz-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label: "", ...rect },
      ]);
      setDrawing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={active ? "default" : "outline"}
          className="h-8 gap-1.5"
          onClick={() => {
            setRedrawId(null);
            setDrawing((v) => !v);
            setPreviewId(null);
          }}
        >
          <Crosshair className="w-3.5 h-3.5" />
          {active ? "Nakreslete obdélník…" : "Přidat zónu přiblížení"}
        </Button>
        {previewId && (
          <Button size="sm" variant="ghost" className="h-8" onClick={() => setPreviewId(null)}>
            Zrušit náhled přiblížení
          </Button>
        )}
      </div>

      <div className="relative">
        <div className="overflow-hidden rounded-xl">
          <div style={zoomStageStyle(previewRect)}>
            <SlideCanvas slide={slide} darkMode={darkMode} />
          </div>
        </div>
        {!previewRect && (
          <ZoomZoneSurface
            zones={zones}
            drawing={active}
            onDraw={handleDraw}
            onZoneClick={(z) => setPreviewId(z.id)}
          />
        )}
      </div>

      {zones.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Zatím žádné zóny. Klikněte na „Přidat zónu přiblížení“ a tažením nakreslete výřez nad náhledem.
        </p>
      ) : (
        <div className="space-y-2">
          {zones.map((z, i) => (
            <div key={z.id} className="flex items-center gap-2">
              <span className="h-6 w-6 shrink-0 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <Input
                className="h-8 text-xs"
                placeholder={`Zóna ${i + 1}`}
                value={z.label || ""}
                onChange={(e) => onChange(zones.map((o) => (o.id === z.id ? { ...o, label: e.target.value } : o)))}
              />
              <Button
                size="sm"
                variant={redrawId === z.id ? "default" : "outline"}
                className="h-8 gap-1"
                onClick={() => {
                  setDrawing(false);
                  setPreviewId(null);
                  setRedrawId((v) => (v === z.id ? null : z.id));
                }}
              >
                <Crosshair className="w-3.5 h-3.5" /> Přesunout
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setPreviewId(z.id)}>
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-destructive"
                onClick={() => onChange(zones.filter((o) => o.id !== z.id))}
                aria-label="Smazat zónu"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Label className="text-[11px] text-muted-foreground font-normal">
        Zóny se ukládají v procentech rozměrů slidu, takže fungují na jakémkoli rozlišení.
      </Label>
    </div>
  );
};

export default ZoomZonesEditor;
