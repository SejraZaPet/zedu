import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BookOpen, LifeBuoy, Home } from "lucide-react";

/**
 * Náhrada za prázdnou stránku „Článek nenalezen“ – vždy nabídne cestu dál
 * (rozcestník nápovědy), aby staré uložené či sdílené odkazy neskončily naslepo.
 */
export default function HelpNotFound({
  title = "Tento návod už na této adrese není",
  description = "Nápovědu jsme přeuspořádali. Najdete ji v rozcestníku – obsah zůstal zachovaný, jen se přesunul.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 text-center shadow-sm">
      <LifeBuoy className="mx-auto mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="mb-2 font-heading text-2xl font-bold text-foreground">{title}</h1>
      <p className="mb-6 text-muted-foreground">{description}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link to="/napoveda">
            <BookOpen className="mr-1 h-4 w-4" /> Rozcestník nápovědy
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">
            <Home className="mr-1 h-4 w-4" /> Domů
          </Link>
        </Button>
      </div>
    </div>
  );
}
