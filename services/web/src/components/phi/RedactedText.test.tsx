import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { RedactedText } from "./RedactedText";
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
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("RedactedText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  it("renders masked text by default", () => {
    render(
      <RedactedText id="test-1" text="123-45-6789" phiType="SSN" />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId("text-masked-test-1")).toBeInTheDocument();
    expect(screen.queryByText("123-45-6789")).not.toBeInTheDocument();
  });

  it("displays mask characters instead of actual text", () => {
    render(
      <RedactedText id="test-2" text="SECRET" phiType="NAME" />,
      { wrapper: createWrapper() }
    );

    const maskedElement = screen.getByTestId("text-masked-test-2");
    expect(maskedElement.textContent).toMatch(/•+/);
  });

  it("shows reveal button when canReveal is true", () => {
    render(
      <RedactedText id="test-3" text="John Doe" phiType="NAME" canReveal={true} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId("button-reveal-test-3")).toBeInTheDocument();
  });

  it("shows locked indicator when canReveal is false", () => {
    render(
      <RedactedText id="test-4" text="Jane Doe" phiType="NAME" canReveal={false} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId("indicator-locked-test-4")).toBeInTheDocument();
    expect(screen.queryByTestId("button-reveal-test-4")).not.toBeInTheDocument();
  });

  it("respects custom mask character", () => {
    render(
      <RedactedText id="test-5" text="ABCD" phiType="OTHER" maskCharacter="*" />,
      { wrapper: createWrapper() }
    );

    const maskedElement = screen.getByTestId("text-masked-test-5");
    expect(maskedElement.textContent).toMatch(/\*+/);
  });

  it("respects custom mask length", () => {
    render(
      <RedactedText id="test-6" text="A" phiType="OTHER" maskLength={10} />,
      { wrapper: createWrapper() }
    );

    const maskedElement = screen.getByTestId("text-masked-test-6");
    expect(maskedElement.textContent).toBe("••••••••••");
  });
});

describe("RedactedText in DEMO mode", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("blocks reveal in DEMO mode", async () => {
    vi.doMock("@/hooks/useGovernanceMode", () => ({
      useGovernanceMode: () => ({
        isDemo: true,
        isStandby: false,
        isLive: false,
        isLoading: false,
        mode: "DEMO",
      }),
    }));

    const { RedactedText: DemoRedactedText } = await import("./RedactedText");

    render(
      <DemoRedactedText id="demo-test" text="PHI Data" phiType="OTHER" />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByTestId("indicator-locked-demo-test")).toBeInTheDocument();
  });
});
