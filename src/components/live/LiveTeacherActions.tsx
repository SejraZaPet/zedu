import type { ReactNode } from "react";
import {
  BarChart3,
  Brain,
  Crosshair,
  LayoutGrid,
  MessageCircleQuestion,
  Monitor,
  Pencil,
  Settings,
  StickyNote,
  Type,
  Wrench,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import GameBackgroundSelect from "@/components/game/GameBackgroundSelect";
import LiveDraftsPanel from "@/components/live/LiveDraftsPanel";
import ProjectorFontScaleControls from "@/components/live/ProjectorFontScaleControls";
import RemoteControlButton from "@/components/live/RemoteControlButton";
import { ClassroomToolsOverlay, classroomTools, type ClassroomToolRequest } from "@/components/classroom/ClassroomToolsOverlay";
import { sessionBackgroundUrl } from "@/lib/game-backgrounds";
import { isManualStart } from "@/lib/live-timing";
import type { ZoomRect, ZoomZone } from "@/lib/zoom-zones";

interface LiveTeacherActionsProps {
  sessionId: string;
  settings: Record<string, any>;
  currentIndex: number;
  slidesCount: number;
  projectorFontScale: number;
  onProjectorFontScaleChange: (value: number) => void;
  whiteboardVisible: boolean;
  onToggleWhiteboard: () => void;
  zoomable: boolean;
  zoomZones: ZoomZone[];
  activeZoom: ZoomRect | null;
  drawZoomMode: boolean;
  onDrawZoomModeChange: (value: boolean) => void;
  onApplyZoom: (rect: ZoomRect | null) => void;
  unansweredCount: number;
  onAdaptiveOpen: () => void;
  onResultsOpen: () => void;
  onProgressOpen: () => void;
  onQuestionsOpen: () => void;
  classroomTool: ClassroomToolRequest | null;
  onClassroomToolChange: (tool: ClassroomToolRequest | null) => void;
  onNotesOpen: () => void;
  onUpdateSettings: (patch: Record<string, any>) => Promise<void>;
  compact?: boolean;
}

function ActionTooltip({ label, children, compact }: { label: string; children: ReactNode; compact: boolean }) {
  if (compact) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function LiveTeacherActions({
  sessionId,
  settings,
  currentIndex,
  slidesCount,
  projectorFontScale,
  onProjectorFontScaleChange,
  whiteboardVisible,
  onToggleWhiteboard,
  zoomable,
  zoomZones,
  activeZoom,
  drawZoomMode,
  onDrawZoomModeChange,
  onApplyZoom,
  unansweredCount,
  onAdaptiveOpen,
  onResultsOpen,
  onProgressOpen,
  onQuestionsOpen,
  classroomTool,
  onClassroomToolChange,
  onNotesOpen,
  onUpdateSettings,
  compact = false,
}: LiveTeacherActionsProps) {
  const iconClass = compact ? "h-11 min-h-11 w-full justify-start gap-2 px-3" : "h-9 w-9";
  const iconSize = compact ? "sm" : "icon" as const;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={compact ? "flex w-full flex-col gap-1" : "flex shrink-0 items-center gap-1"}>
        <LiveDraftsPanel sessionId={sessionId} currentIndex={currentIndex} slidesCount={slidesCount} iconOnly={!compact} />

        <ActionTooltip label="Poznámky řečníka" compact={compact}>
          <Button type="button" size={iconSize} variant="outline" className={iconClass} onClick={onNotesOpen} aria-label="Poznámky řečníka" title="Poznámky řečníka">
            <StickyNote className="h-4 w-4" />{compact && "Poznámky řečníka"}
          </Button>
        </ActionTooltip>

        <Popover>
          <ActionTooltip label="Zvětšení písma" compact={compact}>
            <PopoverTrigger asChild>
              <Button type="button" size={iconSize} variant="outline" className={iconClass} aria-label={`Zvětšení písma, ${projectorFontScale} %`} title="Zvětšení písma">
                <Type className="h-4 w-4" />{compact && `Zvětšení písma · ${projectorFontScale} %`}
              </Button>
            </PopoverTrigger>
          </ActionTooltip>
          <PopoverContent align="end" className="w-auto">
            <p className="mb-2 text-sm font-semibold">Zvětšení písma</p>
            <ProjectorFontScaleControls value={projectorFontScale} onChange={onProjectorFontScaleChange} />
          </PopoverContent>
        </Popover>

        <ActionTooltip label="Otevřít projektor" compact={compact}>
          <Button type="button" size={iconSize} variant="outline" className={iconClass} aria-label="Projektor" title="Projektor" onClick={() => window.open(`/live/projektor/${sessionId}`, "_blank")}>
            <Monitor className="h-4 w-4" />{compact && "Projektor"}
          </Button>
        </ActionTooltip>

        <div className={compact ? "[&_button]:min-h-11 [&_button]:w-full [&_button]:justify-start [&_button]:gap-2 [&_button]:px-3" : ""}>
          <RemoteControlButton sessionId={sessionId} iconOnly={!compact} />
        </div>

        <ActionTooltip label={whiteboardVisible ? "Skrýt tabuli" : "Živá tabule"} compact={compact}>
          <Button type="button" size={iconSize} variant={whiteboardVisible ? "default" : "outline"} className={iconClass} onClick={onToggleWhiteboard} aria-label={whiteboardVisible ? "Skrýt tabuli" : "Tabule"} title="Živá tabule">
            <Pencil className="h-4 w-4" />{compact && (whiteboardVisible ? "Skrýt tabuli" : "Živá tabule")}
          </Button>
        </ActionTooltip>

        {zoomable && (
          <Popover>
            <ActionTooltip label="Přiblížení" compact={compact}>
              <PopoverTrigger asChild>
                <Button type="button" size={iconSize} variant={activeZoom ? "default" : "outline"} className={iconClass} aria-label="Přiblížit" title="Přiblížení">
                  <ZoomIn className="h-4 w-4" />{compact && "Přiblížení"}
                </Button>
              </PopoverTrigger>
            </ActionTooltip>
            <PopoverContent align="end" className="w-80 space-y-3">
              <p className="text-sm font-semibold">Přiblížení</p>
              {zoomZones.length > 0 ? (
                <div className="space-y-1.5">
                  {zoomZones.map((zone, index) => {
                    const isActive = !!activeZoom && Math.abs(activeZoom.x - zone.x) < 0.5 && Math.abs(activeZoom.y - zone.y) < 0.5 && Math.abs(activeZoom.width - zone.width) < 0.5;
                    return (
                      <button key={zone.id} type="button" onClick={() => onApplyZoom({ x: zone.x, y: zone.y, width: zone.width, height: zone.height })} className={`flex min-h-11 w-full items-center gap-2 rounded-lg border-2 px-2 py-1.5 text-left text-xs transition-colors ${isActive ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}>
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{index + 1}</span>
                        <span className="truncate">{zone.label || `Zóna ${index + 1}`}</span>
                      </button>
                    );
                  })}
                </div>
              ) : <p className="text-xs text-muted-foreground">Tento slide nemá uložené zóny přiblížení. Můžete nakreslit výřez přímo teď.</p>}
              <Button type="button" size="sm" variant={drawZoomMode ? "default" : "outline"} className="min-h-11 w-full gap-1.5" onClick={() => onDrawZoomModeChange(!drawZoomMode)}>
                <Crosshair className="h-4 w-4" />{drawZoomMode ? "Ukončit kreslení výřezu" : "Nakreslit výřez"}
              </Button>
              {activeZoom && <Button type="button" size="sm" variant="secondary" className="min-h-11 w-full gap-1.5" onClick={() => onApplyZoom(null)}><ZoomOut className="h-4 w-4" /> Zpět na celý slide</Button>}
            </PopoverContent>
          </Popover>
        )}

        <DropdownMenu>
          <ActionTooltip label="Nástroje" compact={compact}>
            <DropdownMenuTrigger asChild>
              <Button type="button" size={iconSize} variant="outline" className={`${iconClass} relative`} aria-label="Nástroje" title="Nástroje">
                <Wrench className="h-4 w-4" />{compact && "Nástroje"}
                {unansweredCount > 0 && <span className={`inline-flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ${compact ? "ml-auto h-[18px]" : "absolute -right-1.5 -top-1.5 h-[18px]"}`}>{unansweredCount}</span>}
              </Button>
            </DropdownMenuTrigger>
          </ActionTooltip>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Nástroje do hodiny</DropdownMenuLabel>
            {classroomTools.map((tool) => (
              <DropdownMenuItem key={tool.id} onSelect={() => onClassroomToolChange({ id: tool.id })} className="min-h-11 gap-2">
                <tool.icon className="h-4 w-4" />{tool.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Výsledky a spolupráce</DropdownMenuLabel>
            <DropdownMenuItem onSelect={onAdaptiveOpen} className="min-h-11 gap-2"><Brain className="h-4 w-4" /> Adaptivní závěr</DropdownMenuItem>
            <DropdownMenuItem onSelect={onResultsOpen} className="min-h-11 gap-2"><BarChart3 className="h-4 w-4" /> Výsledky třídy</DropdownMenuItem>
            <DropdownMenuItem onSelect={onProgressOpen} className="min-h-11 gap-2"><LayoutGrid className="h-4 w-4" /> Přehled třídy</DropdownMenuItem>
            <DropdownMenuItem onSelect={onQuestionsOpen} className="min-h-11 gap-2"><MessageCircleQuestion className="h-4 w-4" /> Dotazy{unansweredCount > 0 && <span className="ml-auto rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">{unansweredCount}</span>}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <ActionTooltip label="Nastavení prezentace" compact={compact}>
            <PopoverTrigger asChild>
              <Button type="button" size={iconSize} variant="outline" className={iconClass} aria-label="Nastavení prezentace" title="Nastavení">
                <Settings className="h-4 w-4" />{compact && "Nastavení"}
              </Button>
            </PopoverTrigger>
          </ActionTooltip>
          <PopoverContent align="end" className="w-72 space-y-3">
            <p className="text-sm font-semibold">Nastavení prezentace</p>
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>Kreslení žáků do streamu</span><Switch checked={!!settings?.allowStudentDrawSync} onCheckedChange={(checked) => void onUpdateSettings({ allowStudentDrawSync: checked })} aria-label="Povolit kreslení žáků do streamu" /></label>
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>Anonymní odpovědi</span><Switch checked={!!settings?.anonymousAnswers} onCheckedChange={(checked) => void onUpdateSettings({ anonymousAnswers: checked })} aria-label="Anonymní odpovědi na projektoru" /></label>
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>Spouštět aktivity: {isManualStart(settings) ? "ručně" : "automaticky"}</span><Switch checked={isManualStart(settings)} onCheckedChange={(checked) => { const patch: Record<string, any> = { activityStartMode: checked ? "manual" : "auto" }; if (!checked) patch.armedQuestion = null; void onUpdateSettings(patch); }} aria-label="Spouštět aktivity ručně tlačítkem Spustit" /></label>
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>Tempo: {settings?.pacingMode === "student" ? "vlastní tempo" : "učitelem"}</span><Switch checked={settings?.pacingMode === "student"} onCheckedChange={(checked) => void onUpdateSettings({ pacingMode: checked ? "student" : "teacher" })} aria-label="Vlastní tempo žáka" /></label>
            <label className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>Závodní dráha</span><Switch checked={!!settings?.showRaceTrack} onCheckedChange={(checked) => void onUpdateSettings({ showRaceTrack: checked })} aria-label="Zobrazit závodní dráhu na projektoru" /></label>
            <GameBackgroundSelect value={sessionBackgroundUrl(settings)} subjectKey={settings?.subjectKey ?? null} onChange={(url) => void onUpdateSettings({ backgroundUrl: url })} />
          </PopoverContent>
        </Popover>
      </div>
      <ClassroomToolsOverlay request={classroomTool} onClose={() => onClassroomToolChange(null)} />
    </TooltipProvider>
  );
}
