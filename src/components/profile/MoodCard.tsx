import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MOODS, useMood, type Mood } from "@/hooks/useMood";

const MOOD_LABELS: Record<Mood, { name: string; description: string }> = {
  bezli: { name: "Bezli", description: "Původní tyrkysová a fialová." },
  minimal: { name: "Minimal mood", description: "Čistá bílá, grafit a šedá." },
  natural: { name: "Natural mood", description: "Krémová, šalvěj a přírodní tóny." },
  cute: { name: "Cute mood", description: "Roztomilá" },
  ocean: { name: "Ocean mood", description: "Mořská" },
  plum: { name: "Plum mood", description: "Švestková" },
  sunny: { name: "Sunny mood", description: "Slunečná" },
  calm: { name: "Calm mood", description: "Čitelná" },
};

export default function MoodCard() {
  const { mood, setMood } = useMood();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vzhled</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Vyberte si barvy aplikace. Volba se ihned projeví a uloží jen v tomto prohlížeči.
        </p>
        <RadioGroup
          aria-label="Barevná nálada"
          value={mood}
          onValueChange={(value) => setMood(value as Mood)}
          className="grid grid-cols-2 gap-3 md:grid-cols-4"
        >
          {MOODS.map((option) => (
            <Label
              key={option}
              htmlFor={`mood-${option}`}
              className={`flex cursor-pointer flex-col gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                mood === option ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <span className="flex items-start gap-2">
                <RadioGroupItem
                  id={`mood-${option}`}
                  value={option}
                  className="mt-0.5 shrink-0"
                  onKeyDown={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      setMood(option);
                    }
                  }}
                />
                <span>
                  <span className="block text-sm font-medium">{MOOD_LABELS[option].name}</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {MOOD_LABELS[option].description}
                  </span>
                </span>
              </span>
              <span className={`mood-preview mood-preview--${option} grid grid-cols-2 gap-2 rounded-md p-2`} aria-hidden="true">
                <span className="mood-preview__tile flex min-h-14 items-end rounded-md p-2">
                  <span className="mood-preview__line h-2 w-8 rounded-full" />
                </span>
                <span className="mood-preview__tile mood-preview__tile--secondary flex min-h-14 items-end rounded-md p-2">
                  <span className="mood-preview__line h-2 w-6 rounded-full" />
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
