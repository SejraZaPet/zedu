
describe("Popis hodiny", () => {
  it("uloží jen popis, téma neposílá znovu", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const onSaveNote = vi.fn().mockResolvedValue(true);
    render(<LessonTopicEditor topic="Zlomky" note={null} onSave={onSave} onSaveNote={onSaveNote} />);
    fireEvent.click(screen.getByRole("button", { name: /Upravit téma hodiny/ }));
    fireEvent.change(screen.getByLabelText("Popis hodiny"), { target: { value: "  Přineste kružítko " } });
    expect(screen.getByText("19 / 1000")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
    await waitFor(() => expect(onSaveNote).toHaveBeenCalledWith("Přineste kružítko"));
    expect(onSave).not.toHaveBeenCalled();
  });
  it("popis se ukáže na kartě a pole má limit 1000", () => {
    render(<LessonTopicEditor topic={null} note={"Řádek 1\nŘádek 2"} onSave={vi.fn()} onSaveNote={vi.fn()} />);
    expect(screen.getByTestId("lesson-note")).toHaveTextContent("Řádek 1");
    fireEvent.click(screen.getByRole("button", { name: /Přidat téma hodiny/ }));
    expect(screen.getByLabelText("Popis hodiny")).toHaveAttribute("maxLength", "1000");
  });
});
