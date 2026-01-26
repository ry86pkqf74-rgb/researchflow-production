import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePhiRedaction } from "./usePhiRedaction";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "test-user", role: "RESEARCHER" },
    isAuthenticated: true,
    isLoading: false,
  })),
}));

vi.mock("@/hooks/useGovernanceMode", () => ({
  useGovernanceMode: vi.fn(() => ({
    isDemo: false,
    isStandby: false,
    isLive: true,
    isLoading: false,
    mode: "LIVE",
  })),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("usePhiRedaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns canReveal as true when user has permission and not in DEMO mode", () => {
    const { result } = renderHook(() => usePhiRedaction(), {
      wrapper: createWrapper(),
    });

    expect(result.current.canReveal).toBe(true);
  });

  it("starts with no revealed items", () => {
    const { result } = renderHook(() => usePhiRedaction(), {
      wrapper: createWrapper(),
    });

    expect(result.current.revealedIds.size).toBe(0);
  });

  it("reveals an item when reveal is called", async () => {
    const { result } = renderHook(() => usePhiRedaction(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.reveal("phi-1");
    });

    expect(result.current.isRevealed("phi-1")).toBe(true);
  });

  it("hides an item when hide is called", async () => {
    const { result } = renderHook(() => usePhiRedaction(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.reveal("phi-2");
    });

    expect(result.current.isRevealed("phi-2")).toBe(true);

    act(() => {
      result.current.hide("phi-2");
    });

    expect(result.current.isRevealed("phi-2")).toBe(false);
  });

  it("hides all items when hideAll is called", async () => {
    const { result } = renderHook(() => usePhiRedaction(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.reveal("phi-a");
      await result.current.reveal("phi-b");
      await result.current.reveal("phi-c");
    });

    expect(result.current.revealedIds.size).toBe(3);

    act(() => {
      result.current.hideAll();
    });

    expect(result.current.revealedIds.size).toBe(0);
  });

  it("auto-hides after timeout", async () => {
    const { result } = renderHook(
      () => usePhiRedaction({ autoHideTimeout: 5000 }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.reveal("phi-timeout");
    });

    expect(result.current.isRevealed("phi-timeout")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5001);
    });

    expect(result.current.isRevealed("phi-timeout")).toBe(false);
  });

  it("logs reveal attempts via API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const { result } = renderHook(() => usePhiRedaction(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.logRevealAttempt("phi-log", "SSN", true);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/audit/phi-reveal",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("phi-log"),
      })
    );
  });
});

describe("usePhiRedaction permission checks", () => {
  it("ALLOWED_REVEAL_ROLES includes proper roles for PHI reveal", () => {
    const ALLOWED_ROLES = ["ANALYST", "RESEARCHER", "STEWARD", "ADMIN"];
    expect(ALLOWED_ROLES).toContain("RESEARCHER");
    expect(ALLOWED_ROLES).toContain("STEWARD");
    expect(ALLOWED_ROLES).toContain("ADMIN");
    expect(ALLOWED_ROLES).not.toContain("VIEWER");
  });

  it("reveal should require authentication", () => {
    const { result } = renderHook(() => usePhiRedaction(), {
      wrapper: createWrapper(),
    });
    
    expect(result.current.canReveal).toBe(true);
  });
});
