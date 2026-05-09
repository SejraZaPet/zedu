import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Download, CalendarPlus, Link2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  type CalendarExportEvent,
  buildIcsDataUrl,
  downloadICS,
  generateGoogleCalendarUrl,
} from "@/lib/calendar-export";

interface Props {
  /** All events in current view (for .ics + subscribe link) */
  events: CalendarExportEvent[];
  /** Single highlighted event for "Add to Google" – falls back to first event */
  primaryEvent?: CalendarExportEvent;
  filename?: string;
  calName?: string;
  label?: string;
}

export function CalendarExportMenu({
  events,
  primaryEvent,
  filename = "zedu-kalendar.ics",
  calName = "ZEdu kalendář",
  label = "Exportovat",
}: Props) {
  const { toast } = useToast();
  const single = primaryEvent ?? events[0];

  const handleIcs = () => {
    if (events.length === 0) {
      toast({ title: "Žádné události k exportu", variant: "destructive" });
      return;
    }
    downloadICS(events, filename, calName);
  };

  const handleGoogle = () => {
    if (!single) {
      toast({ title: "Vyberte událost", variant: "destructive" });
      return;
    }
    window.open(generateGoogleCalendarUrl(single), "_blank", "noopener,noreferrer");
  };

  const handleCopyLink = async () => {
    if (events.length === 0) {
      toast({ title: "Žádné události k exportu", variant: "destructive" });
      return;
    }
    const url = buildIcsDataUrl(events, calName);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Odkaz zkopírován", description: "Vložte ho do svého kalendáře jako odběr." });
    } catch {
      toast({ title: "Nelze zkopírovat odkaz", variant: "destructive" });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Export kalendáře</DropdownMenuLabel>
        <DropdownMenuItem onClick={handleIcs}>
          <Download className="w-4 h-4 mr-2" />
          Stáhnout .ics (Apple/Outlook)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleGoogle} disabled={!single}>
          <CalendarPlus className="w-4 h-4 mr-2" />
          Přidat do Google Calendar
          <ExternalLink className="w-3 h-3 ml-auto opacity-60" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyLink}>
          <Link2 className="w-4 h-4 mr-2" />
          Kopírovat odkaz pro odběr
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
