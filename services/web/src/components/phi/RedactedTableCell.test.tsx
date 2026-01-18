import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RedactedTableCell, RedactedTableRow } from "./RedactedTableCell";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    user: { id: "test-user", role: "RESEARCHER" },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useGovernanceMode", () => ({
  useGovernanceMode: () => ({
    isDemo: false,
    isStandby: false,
    isLive: true,
    isLoading: false,
    mode: "LIVE",
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <table>
        <tbody>
          <tr>{children}</tr>
        </tbody>
      </table>
    </QueryClientProvider>
  );
};

describe("RedactedTableCell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  it("renders with blurred content by default", () => {
    render(
      <RedactedTableCell id="cell-1" phiType="SSN">
        <span>123-45-6789</span>
      </RedactedTableCell>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId("cell-phi-cell-1")).toBeInTheDocument();
    expect(screen.getByTestId("content-blurred-cell-1")).toBeInTheDocument();
  });

  it("shows revealed content when isRevealed is true", () => {
    render(
      <RedactedTableCell id="cell-2" phiType="NAME" isRevealed={true}>
        <span>John Doe</span>
      </RedactedTableCell>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId("content-revealed-cell-2")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("has amber border when hidden", () => {
    render(
      <RedactedTableCell id="cell-3" phiType="DOB">
        <span>01/01/1990</span>
      </RedactedTableCell>,
      { wrapper: createWrapper() }
    );

    const cell = screen.getByTestId("cell-phi-cell-3");
    expect(cell).toHaveClass("border-l-amber-400");
  });

  it("has green border when revealed", () => {
    render(
      <RedactedTableCell id="cell-4" phiType="DOB" isRevealed={true}>
        <span>01/01/1990</span>
      </RedactedTableCell>,
      { wrapper: createWrapper() }
    );

    const cell = screen.getByTestId("cell-phi-cell-4");
    expect(cell).toHaveClass("border-l-green-400");
  });

  it("shows toggle button when user can reveal", () => {
    render(
      <RedactedTableCell id="cell-5" phiType="EMAIL">
        <span>test@example.com</span>
      </RedactedTableCell>,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId("button-toggle-cell-5")).toBeInTheDocument();
  });
});

describe("RedactedTableRow", () => {
  it("renders children correctly", () => {
    render(
      <table>
        <tbody>
          <RedactedTableRow hasPhi={true}>
            <td data-testid="test-cell">Content</td>
          </RedactedTableRow>
        </tbody>
      </table>
    );

    expect(screen.getByTestId("test-cell")).toBeInTheDocument();
    expect(screen.getByTestId("row-contains-phi")).toBeInTheDocument();
  });

  it("applies PHI indicator styles when hasPhi is true", () => {
    render(
      <table>
        <tbody>
          <RedactedTableRow hasPhi={true}>
            <td>Content</td>
          </RedactedTableRow>
        </tbody>
      </table>
    );

    const row = screen.getByTestId("row-contains-phi");
    expect(row).toHaveClass("bg-amber-50/50");
  });

  it("does not apply PHI styles when hasPhi is false", () => {
    render(
      <table>
        <tbody>
          <RedactedTableRow hasPhi={false}>
            <td data-testid="non-phi-cell">Content</td>
          </RedactedTableRow>
        </tbody>
      </table>
    );

    expect(screen.queryByTestId("row-contains-phi")).not.toBeInTheDocument();
  });
});
