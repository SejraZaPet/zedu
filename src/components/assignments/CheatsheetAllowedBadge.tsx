import { cheatSheetAllowed } from "@/lib/cheatsheet";
import { Badge } from "@/components/ui/badge";
export default function CheatsheetAllowedBadge({ settings }: { settings: unknown }) {
  return cheatSheetAllowed(settings) ? <Badge variant="outline">Tahák povolen</Badge> : null;
}