import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/ui/button";

describe("Button na barevném nebo gradientním podkladu", () => {
  it("hlavní akce má světlé pozadí, tmavý text, okraj a viditelný focus ring", () => {
    const classes = buttonVariants({ variant: "onColor" });
    expect(classes).toContain("bg-background");
    expect(classes).toContain("text-foreground");
    expect(classes).toContain("border-background");
    expect(classes).toContain("focus-visible:ring-background");
    expect(classes).toContain("focus-visible:ring-offset-primary");
  });

  it("obrysová akce oddělí bílý text a okraj od světlých částí přechodu", () => {
    const classes = buttonVariants({ variant: "onColorOutline" });
    expect(classes).toContain("border-primary-foreground");
    expect(classes).toContain("text-primary-foreground");
    expect(classes).toContain("bg-foreground/35");
    expect(classes).toContain("focus-visible:ring-background");
  });

  it("destruktivní akce má světlé pozadí a tmavě červený text i okraj", () => {
    const classes = buttonVariants({ variant: "onColorDestructive" });
    expect(classes).toContain("bg-background");
    expect(classes).toContain("text-destructive-strong");
    expect(classes).toContain("border-destructive-strong");
    expect(classes).toContain("focus-visible:ring-background");
  });
});
