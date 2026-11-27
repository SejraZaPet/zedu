import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PollActivity from "@/components/activities/PollActivity";
import PollProjectorView from "@/components/activities/PollProjectorView";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  rpc: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    rpc: mocks.rpc,
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

const options = [
  { id: "a", text: "[TEST] Spolupráce" },
  { id: "b", text: "[TEST] Praxe" },
  { id: "c", text: "[TEST] Inspirace" },
  { id: "d", text: "[TEST] Zvědavost" },
];

const optionsWithoutIds = options.map(({ text }) => ({ text }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.invoke.mockResolvedValue({ data: {}, error: null });
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  mocks.channel.mockReturnValue(channel);
});

describe("PollActivity – výběr odpovědi", () => {
  it("celý řádek přepne výběr a zpřístupní hlasování", () => {
    render(<PollActivity question="[TEST] Otázka" options={options} />);
    const first = screen.getByRole("button", { name: "[TEST] Spolupráce" });
    const second = screen.getByRole("button", { name: "[TEST] Praxe" });
    const vote = screen.getByRole("button", { name: "Hlasovat" });

    expect(vote).toBeDisabled();
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(vote).toBeEnabled();

    fireEvent.click(second);
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(second).toHaveAttribute("aria-pressed", "true");
  });

  it("u více odpovědí umožní vybrat i odznačit jednotlivé možnosti", () => {
    render(<PollActivity question="[TEST] Otázka" options={options} allowMultiple />);
    const first = screen.getByRole("button", { name: "[TEST] Spolupráce" });
    const second = screen.getByRole("button", { name: "[TEST] Praxe" });

    fireEvent.click(first);
    fireEvent.click(second);
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(second).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(second).toHaveAttribute("aria-pressed", "true");
  });

  it("u možností bez ID označí jen vybranou možnost a odešle její index", async () => {
    render(
      <PollActivity
        question="[TEST] Otázka"
        options={optionsWithoutIds}
        sessionId="[TEST] relace"
        questionIndex={0}
        playerId="[TEST] žák"
        joinToken="[TEST] token"
      />,
    );
    const buttons = optionsWithoutIds.map((option) =>
      screen.getByRole("button", { name: option.text }),
    );

    fireEvent.click(buttons[1]);
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
    buttons.filter((_, index) => index !== 1).forEach((button) => {
      expect(button).toHaveAttribute("aria-pressed", "false");
    });

    fireEvent.click(screen.getByRole("button", { name: "Hlasovat" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    expect(mocks.invoke).toHaveBeenCalledWith(
      "submit-activity-response",
      expect.objectContaining({
        body: expect.objectContaining({
          answerData: { selectedOptions: ["1"] },
        }),
      }),
    );
  });
});

describe("PollProjectorView – počítání hlasů", () => {
  it("u možností bez ID sečte řetězcové i číselné indexy", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        { answer: { selectedOptions: ["0"] } },
        { answer: { selectedOptions: [0] } },
        { answer: { selectedOptions: ["2"] } },
      ],
      error: null,
    });
    render(
      <PollProjectorView
        question="[TEST] Otázka"
        options={optionsWithoutIds.slice(0, 3)}
        sessionId="[TEST] relace"
        questionIndex={0}
        totalPlayers={3}
      />,
    );

    expect(await screen.findByText("3 hlasů z 3 žáků")).toBeInTheDocument();
    expect(screen.getByText("2 (67%)")).toBeInTheDocument();
    expect(screen.getByText("0 (0%)")).toBeInTheDocument();
    expect(screen.getByText("1 (33%)")).toBeInTheDocument();
  });

  it("u možností s vlastním ID počítá podle ID, nikoli podle pořadí", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        { answer: { selectedOptions: ["b"] } },
        { answer: { selectedOptions: ["b"] } },
        { answer: { selectedOptions: ["a"] } },
        { answer: { selectedOptions: [2] } },
      ],
      error: null,
    });
    render(
      <PollProjectorView
        question="[TEST] Otázka"
        options={options.slice(0, 3)}
        sessionId="[TEST] relace"
        questionIndex={0}
        totalPlayers={4}
      />,
    );

    expect(await screen.findByText("3 hlasů z 4 žáků")).toBeInTheDocument();
    expect(screen.getByText("1 (33%)")).toBeInTheDocument();
    expect(screen.getByText("2 (67%)")).toBeInTheDocument();
    expect(screen.getByText("0 (0%)")).toBeInTheDocument();
  });
});
