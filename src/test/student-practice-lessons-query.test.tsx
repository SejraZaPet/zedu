import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useStudentPracticeLessons } from "@/hooks/useStudentPracticeLessons";
import { practiceLessonSelectOptions } from "@/lib/student-practice-lessons";

const mocks = vi.hoisted(() => ({ fetchLessons: vi.fn() }));
vi.mock("@/lib/student-practice-lessons", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/student-practice-lessons")>()),
  fetchStudentPracticeLessons: mocks.fetchLessons,
}));

globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as any;
Element.prototype.scrollIntoView = () => {};

const groups = [{ subject: "Přírodopis", lessons: [{ id: "l1", title: "Buňka", textbook: "Přírodopis 7", subject: "Přírodopis" }] }];

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function Picker() {
  const lessonsQuery = useStudentPracticeLessons("student-1");
  return <SearchableSelect
    value=""
    onValueChange={vi.fn()}
    options={practiceLessonSelectOptions(lessonsQuery.data ?? [])}
    label="Hledat lekci"
    triggerLabel="Lekce pro studijní pomůcku"
    loading={lessonsQuery.isPending && lessonsQuery.data === undefined}
    loadingLabel="Načítám tvoje lekce…"
    error={lessonsQuery.isError ? "Lekce se nepodařilo načíst" : null}
    retrying={lessonsQuery.isFetching}
    onRetry={() => { void lessonsQuery.refetch(); }}
  />;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Sdílená cache lekcí pro SearchableSelect", () => {
  it("druhé otevření použije data z cache a nespustí nové dotazy", async () => {
    mocks.fetchLessons.mockResolvedValue(groups);
    const queryClient = client();
    const Wrapper = wrapper(queryClient);
    const first = render(<Wrapper><Picker /></Wrapper>);
    fireEvent.click(await screen.findByRole("combobox", { name: "Lekce pro studijní pomůcku" }));
    expect(await screen.findByRole("option", { name: /Buňka/ })).toBeInTheDocument();
    expect(mocks.fetchLessons).toHaveBeenCalledTimes(1);
    first.unmount();

    render(<Wrapper><Picker /></Wrapper>);
    const secondTrigger = screen.getByRole("combobox", { name: "Lekce pro studijní pomůcku" });
    fireEvent.click(secondTrigger);
    expect(screen.getByRole("option", { name: /Buňka/ })).toBeInTheDocument();
    expect(mocks.fetchLessons).toHaveBeenCalledTimes(1);
  });

  it("při prvním načtení ukáže skeleton a po chybě umožní opakovat dotaz", async () => {
    let resolve!: (value: typeof groups) => void;
    mocks.fetchLessons.mockImplementationOnce(() => new Promise<typeof groups>((done) => { resolve = done; }));
    const queryClient = client();
    const Wrapper = wrapper(queryClient);
    const first = render(<Wrapper><Picker /></Wrapper>);
    expect(screen.getByTestId("searchable-select-loading")).toBeInTheDocument();
    resolve(groups);
    expect(await screen.findByRole("combobox", { name: "Lekce pro studijní pomůcku" })).toBeInTheDocument();
    first.unmount();

    mocks.fetchLessons.mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(groups);
    const retryClient = client();
    const RetryWrapper = wrapper(retryClient);
    render(<RetryWrapper><Picker /></RetryWrapper>);
    expect(await screen.findByRole("alert", {}, { timeout: 2500 })).toHaveTextContent("Lekce se nepodařilo načíst");
    fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Lekce pro studijní pomůcku" })).toBeInTheDocument());
    expect(mocks.fetchLessons).toHaveBeenCalledTimes(4);
  });
});
