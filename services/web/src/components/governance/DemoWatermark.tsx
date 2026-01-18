import { useGovernanceMode } from "@/hooks/useGovernanceMode";

export function DemoWatermark() {
  const { isDemo, isLoading } = useGovernanceMode();

  if (isLoading || !isDemo) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
      aria-hidden="true"
      data-testid="demo-watermark"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="text-8xl font-bold text-muted-foreground/10 whitespace-nowrap select-none"
          style={{
            transform: "rotate(-45deg)",
            letterSpacing: "0.2em",
          }}
        >
          DEMO MODE
        </div>
      </div>
    </div>
  );
}
