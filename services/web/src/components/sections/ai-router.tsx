import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Bot,
  Brain,
  Sparkles,
  Server,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { motion } from "framer-motion";

interface ProviderData {
  id: string;
  name: string;
  model: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "Active" | "Standby" | "Rate Limited";
  latency: string;
  costPer1K: string;
  tokensUsed: number;
}

const providers: ProviderData[] = [
  {
    id: "openai",
    name: "OpenAI",
    model: "GPT-4",
    icon: Bot,
    status: "Active",
    latency: "~2.3s",
    costPer1K: "$0.03",
    tokensUsed: 450000,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    model: "Claude 3",
    icon: Brain,
    status: "Active",
    latency: "~1.8s",
    costPer1K: "$0.02",
    tokensUsed: 320000,
  },
  {
    id: "google",
    name: "Google",
    model: "Gemini",
    icon: Sparkles,
    status: "Standby",
    latency: "~1.5s",
    costPer1K: "$0.025",
    tokensUsed: 80000,
  },
  {
    id: "local",
    name: "Local",
    model: "Llama 2",
    icon: Server,
    status: "Standby",
    latency: "~0.8s",
    costPer1K: "$0.00",
    tokensUsed: 150000,
  },
];

const costByStage = [
  { stage: "Data Processing", cost: 12.5, percentage: 18 },
  { stage: "Analysis", cost: 28.3, percentage: 41 },
  { stage: "Synthesis", cost: 15.2, percentage: 22 },
  { stage: "Verification", cost: 12.0, percentage: 17 },
];

export function AIRouter() {
  const [monthlyBudget, setMonthlyBudget] = useState(100);
  const [autoSwitch, setAutoSwitch] = useState(true);
  const [alertThreshold, setAlertThreshold] = useState(80);

  const totalTokensUsed = providers.reduce((sum, p) => sum + p.tokensUsed, 0);
  const totalCostUsed = 68;
  const budgetRemaining = monthlyBudget - totalCostUsed;
  const budgetPercentage = (totalCostUsed / monthlyBudget) * 100;

  const getBudgetColor = (percentage: number) => {
    if (percentage < alertThreshold) return "text-ros-success";
    if (percentage < 100) return "text-ros-alert";
    return "text-red-600 dark:text-red-500";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-ros-success/10 text-ros-success border-ros-success/20";
      case "Standby":
        return "bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20";
      case "Rate Limited":
        return "bg-ros-alert/10 text-ros-alert border-ros-alert/20";
      default:
        return "bg-muted/50 text-muted-foreground";
    }
  };

  return (
    <section className="py-16 lg:py-24" data-testid="section-ai-router">
      <div className="container mx-auto px-6 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 lg:mb-16"
        >
          <Badge
            variant="secondary"
            className="mb-4 px-4 py-1.5 bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20"
            data-testid="badge-ai-router-section"
          >
            AI Provider Management
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-ai-router-heading">
            Intelligent Provider Routing & Cost Control
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-ai-router-description">
            Optimize AI provider selection, monitor real-time costs, and enforce budget controls across your research pipeline.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-4 gap-4 mb-12">
          {providers.map((provider, index) => {
            const Icon = provider.icon;
            return (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                data-testid={`card-provider-${provider.id}`}
              >
                <Card className="p-5 h-full border-border/50 flex flex-col gap-4 hover-elevate">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-lg bg-ros-workflow/10 text-ros-workflow flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge
                      className={`text-xs whitespace-nowrap ${getStatusColor(provider.status)}`}
                      data-testid={`badge-provider-status-${provider.id}`}
                    >
                      {provider.status}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold" data-testid={`text-provider-name-${provider.id}`}>
                      {provider.name}
                    </h3>
                    <p className="text-xs text-muted-foreground" data-testid={`text-provider-model-${provider.id}`}>
                      {provider.model}
                    </p>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between" data-testid={`stat-latency-${provider.id}`}>
                      <span className="text-muted-foreground">Latency</span>
                      <span className="font-medium">{provider.latency}</span>
                    </div>
                    <div className="flex items-center justify-between" data-testid={`stat-cost-${provider.id}`}>
                      <span className="text-muted-foreground">Cost/1K</span>
                      <span className="font-medium text-ros-primary">{provider.costPer1K}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground" data-testid={`text-tokens-used-${provider.id}`}>
                      {(provider.tokensUsed / 1000).toFixed(0)}K tokens used
                    </p>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="p-6 lg:p-8 border-border/50" data-testid="card-usage-dashboard">
              <h3 className="text-lg font-semibold mb-6" data-testid="text-usage-dashboard-title">
                Monthly Usage Dashboard
              </h3>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between" data-testid="stat-tokens-used">
                    <span className="text-sm text-muted-foreground">Total Tokens Used</span>
                    <span className="text-2xl font-bold text-ros-primary">
                      {(totalTokensUsed / 1000000).toFixed(1)}M
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cumulative tokens across all active providers
                  </p>
                </div>

                <div className="space-y-3" data-testid="section-budget-progress">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Budget Remaining</span>
                    <span className={`text-sm font-semibold ${getBudgetColor(budgetPercentage)}`}>
                      ${budgetRemaining.toFixed(2)} / ${monthlyBudget.toFixed(2)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(budgetPercentage, 100)}
                    className="h-3"
                    data-testid="progress-budget"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>${totalCostUsed.toFixed(2)} spent</span>
                    <span>{budgetPercentage.toFixed(1)}% used</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <h4 className="text-sm font-medium mb-4">Cost by Stage</h4>
                  <div className="space-y-3" data-testid="section-cost-by-stage">
                    {costByStage.map((item, index) => (
                      <div key={index} className="space-y-1" data-testid={`stage-cost-${index}`}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{item.stage}</span>
                          <span className="font-medium">${item.cost.toFixed(2)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-ros-workflow rounded-full"
                            initial={{ width: 0 }}
                            whileInView={{ width: `${item.percentage}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.3 + index * 0.1 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg" data-testid="section-cost-trend">
                  <TrendingUp className="h-4 w-4 text-ros-alert" />
                  <div>
                    <p className="text-xs font-medium">
                      Cost trend: <span className="text-ros-alert">+5.2%</span> vs last month
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Current run rate: ${(totalCostUsed * 1.05).toFixed(2)}/month
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card className="p-6 border-border/50" data-testid="card-budget-controls">
              <h3 className="text-lg font-semibold mb-6" data-testid="text-budget-controls-title">
                Budget Controls
              </h3>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="budget-limit" className="text-sm font-medium">
                    Monthly Budget Limit
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      id="budget-limit"
                      type="number"
                      value={monthlyBudget}
                      onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                      className="text-lg font-semibold"
                      data-testid="input-budget-limit"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="auto-switch" className="text-sm font-medium">
                      Auto-Switch on Rate Limit
                    </label>
                    <Switch
                      id="auto-switch"
                      checked={autoSwitch}
                      onCheckedChange={setAutoSwitch}
                      data-testid="switch-auto-switch"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {autoSwitch
                      ? "Automatically switch to next available provider"
                      : "Disabled - manual provider selection"}
                  </p>
                </div>

                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <label htmlFor="alert-threshold" className="text-sm font-medium">
                      Alert Threshold
                    </label>
                    <span className="text-sm font-semibold text-ros-alert">{alertThreshold}%</span>
                  </div>
                  <Slider
                    id="alert-threshold"
                    min={50}
                    max={95}
                    step={5}
                    value={[alertThreshold]}
                    onValueChange={(value) => setAlertThreshold(value[0])}
                    className="w-full"
                    data-testid="slider-alert-threshold"
                  />
                  <p className="text-xs text-muted-foreground">
                    Alert when budget usage exceeds {alertThreshold}%
                  </p>
                </div>

                <div className="flex items-start gap-2 p-3 bg-ros-success/10 rounded-lg border border-ros-success/20" data-testid="section-budget-status">
                  {budgetPercentage < alertThreshold ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-ros-success flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-medium text-ros-success">Budget Healthy</p>
                        <p className="text-ros-success/70">
                          {budgetPercentage < alertThreshold ? (
                            <>Under alert threshold</>
                          ) : budgetPercentage < 100 ? (
                            <>Near budget limit</>
                          ) : (
                            <>Over budget</>
                          )}
                        </p>
                      </div>
                    </>
                  ) : budgetPercentage < 100 ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-ros-alert flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-medium text-ros-alert">Alert: Approaching Limit</p>
                        <p className="text-ros-alert/70">
                          {(100 - budgetPercentage).toFixed(2)}% remaining
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-medium text-red-600 dark:text-red-500">Over Budget</p>
                        <p className="text-red-600/70 dark:text-red-500/70">
                          ${Math.abs(budgetRemaining).toFixed(2)} over limit
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  data-testid="button-view-details"
                >
                  View Detailed Logs
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
