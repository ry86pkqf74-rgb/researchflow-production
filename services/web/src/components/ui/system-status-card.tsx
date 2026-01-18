import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Activity, Wifi, WifiOff, AlertTriangle } from "lucide-react";

interface HealthStatus {
  status: "healthy" | "degraded";
  timestamp: string;
  services: {
    express: { status: "up" | "down" };
    ros_backend: { status: "up" | "down"; mode?: string };
  };
  environment: {
    mock_only: boolean;
    no_network: boolean;
    allow_uploads: boolean;
  };
}

interface SystemStatusCardProps {
  variant?: "compact" | "detailed";
  refreshInterval?: number;
}

export function SystemStatusCard({
  variant = "compact",
  refreshInterval = 30000,
}: SystemStatusCardProps) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchHealth = async () => {
    try {
      const response = await fetch("/api/v1/health");
      const data = await response.json();
      setHealth(data);
      setError(false);
    } catch {
      setError(true);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getStatusColor = (status: "up" | "down" | undefined) => {
    if (status === "up") return "bg-green-500";
    if (status === "down") return "bg-red-500";
    return "bg-yellow-500";
  };

  const getStatusDot = (status: "up" | "down" | undefined) => (
    <span
      className={`inline-block w-2 h-2 rounded-full ${getStatusColor(status)}`}
      data-testid={`status-dot-${status || "unknown"}`}
    />
  );

  const isLiveMode = health?.services.ros_backend.mode === "LIVE" && !health?.environment.mock_only;

  if (loading) {
    return (
      <Card className="w-full" data-testid="system-status-card-loading">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="h-4 w-4 animate-pulse" />
            <span className="text-sm">Checking system status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !health) {
    return (
      <Card className="w-full border-destructive/50" data-testid="system-status-card-error">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">Unable to fetch system status</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasWarning = health.services.ros_backend.status === "down" || health.status === "degraded";

  if (variant === "compact") {
    return (
      <Card className={`w-full ${hasWarning ? "border-yellow-500/50" : ""}`} data-testid="system-status-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5" data-testid="service-express">
                {getStatusDot(health.services.express.status)}
                <Server className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-1.5" data-testid="service-ros">
                {getStatusDot(health.services.ros_backend.status)}
                {health.environment.no_network ? (
                  <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            </div>
            <Badge
              variant={isLiveMode ? "default" : "secondary"}
              className="text-xs"
              data-testid="mode-badge"
            >
              {isLiveMode ? "LIVE" : "STANDBY"}
            </Badge>
          </div>
          {hasWarning && (
            <div className="mt-2 flex items-center gap-1.5 text-yellow-600 dark:text-yellow-500" data-testid="status-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-xs">Some services are unavailable</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`w-full ${hasWarning ? "border-yellow-500/50" : ""}`} data-testid="system-status-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between gap-2">
          <span>System Status</span>
          <Badge
            variant={isLiveMode ? "default" : "secondary"}
            className="text-xs"
            data-testid="mode-badge"
          >
            {isLiveMode ? "LIVE" : "STANDBY"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between" data-testid="service-express-row">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Express Server</span>
            </div>
            <div className="flex items-center gap-1.5">
              {getStatusDot(health.services.express.status)}
              <span className="text-xs text-muted-foreground capitalize">
                {health.services.express.status}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between" data-testid="service-ros-row">
            <div className="flex items-center gap-2">
              {health.environment.no_network ? (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Wifi className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm">ROS Backend</span>
            </div>
            <div className="flex items-center gap-1.5">
              {getStatusDot(health.services.ros_backend.status)}
              <span className="text-xs text-muted-foreground capitalize">
                {health.services.ros_backend.status}
              </span>
            </div>
          </div>
        </div>

        {hasWarning && (
          <div className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded-md" data-testid="status-warning">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            <span className="text-xs text-yellow-600 dark:text-yellow-500">
              Some services are currently unavailable
            </span>
          </div>
        )}

        <div className="pt-2 border-t text-xs text-muted-foreground" data-testid="environment-info">
          <div className="flex items-center justify-between">
            <span>Mock Mode</span>
            <span>{health.environment.mock_only ? "Yes" : "No"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Uploads</span>
            <span>{health.environment.allow_uploads ? "Enabled" : "Disabled"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
