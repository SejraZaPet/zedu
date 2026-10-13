import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AssignmentDescription from "@/components/assignments/AssignmentDescription";
import {
  assignmentDescriptionToEditorHtml,
  assignmentDescriptionToText,
  sanitizeAssignmentDescription,
} from "@/lib/assignment-description";

describe("formátovaný popis úkolu", () => {
  it("zachová starý prostý text a jeho zalomení", () => {
    render(<AssignmentDescription description={"První řádek\nDruhý řádek"} />);
    expect(screen.getByText(/První řádek/)).toHaveTextContent("První řádekDruhý řádek");
    expect(assignmentDescriptionToEditorHtml("A\nB")).toBe("<p>A<br>B</p>");
  });

  it("zachová podporované formátování a bezpečnou barvu", () => {
    const clean = sanitizeAssignmentDescription(
      '<p><strong>Tučně</strong> <em>Kurzíva</em> <u>Podtržení</u> <span style="color: #2563eb">Modře</span></p>',
    );
    expect(clean).toContain("<strong>Tučně</strong>");
    expect(clean).toContain("<em>Kurzíva</em>");
    expect(clean).toContain("<u>Podtržení</u>");
    expect(clean).toMatch(/color:\s*(#2563eb|rgb\(37, 99, 235\))/i);
  });

  it("odstraní nepovolené HTML a vrátí čistý text pro čtení", () => {
    const unsafe = '<p>Ahoj <strong>žáku</strong></p><script>alert(1)</script><img src=x onerror=alert(2)>';
    const clean = sanitizeAssignmentDescription(unsafe);
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("img");
    expect(clean).not.toContain("onerror");
    expect(assignmentDescriptionToText(unsafe)).toBe("Ahoj žáku");
  });

  it("zobrazí náhled NÁVOD PRO KÁMOŠE bez značek a oddělí nadpis od odstavce", () => {
    const description = '<h1><span style="color: rgb(147, 51, 234);">NÁVOD PRO KÁMOŠE</span></h1><p>Představ si, že vytvoříš <strong>návod ve Wordu</strong>.</p>';
    const preview = assignmentDescriptionToText(description);
    render(<p className="line-clamp-2">{preview}</p>);
    expect(preview).toBe("NÁVOD PRO KÁMOŠE\nPředstav si, že vytvoříš návod ve Wordu.");
    expect(screen.getByText(/NÁVOD PRO KÁMOŠE/)).not.toHaveTextContent(/<h1>|<span|style=|<p>/);
  });

  it("převede seznam a entity na čitelný text bez spojených položek", () => {
    expect(assignmentDescriptionToText('<ul><li>Soubor &amp; obrázek</li><li>Odevzdání</li></ul>'))
      .toBe("Soubor & obrázek\nOdevzdání");
  });
});