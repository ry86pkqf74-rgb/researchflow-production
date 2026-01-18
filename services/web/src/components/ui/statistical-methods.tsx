import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePhiGate, PhiStatusBadge } from "@/components/ui/phi-gate";
import {
  Copy,
  Check,
  FileText,
  Calculator,
  Target,
  Settings2,
  Users,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  type SAPConfig,
  generateMethodsText,
  generateMethodsProse,
  formatEndpoints,
  formatStatisticalTests,
  formatCovariates,
  formatAlphaLevel,
} from "@/lib/sap-to-methods";

interface StatisticalMethodsPageProps {
  config: SAPConfig;
  onRegenerate?: () => void;
}

export function StatisticalMethodsPage({ config, onRegenerate }: StatisticalMethodsPageProps) {
  const { phiStatus } = usePhiGate();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"structured" | "prose">("prose");

  const structuredText = generateMethodsText(config);
  const proseText = generateMethodsProse(config);

  const handleCopy = useCallback(async () => {
    const textToCopy = activeTab === "prose" ? proseText : structuredText;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  }, [activeTab, proseText, structuredText]);

  const primaryEndpoints = config.endpoints.filter((e) => e.type === "primary");
  const secondaryEndpoints = config.endpoints.filter((e) => e.type === "secondary");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card className="border-ros-primary/20 bg-gradient-to-br from-ros-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-ros-primary" />
              <CardTitle className="text-lg">Statistical Methods</CardTitle>
              <Badge variant="secondary" className="text-xs">
                Auto-generated
              </Badge>
              <PhiStatusBadge status={phiStatus} size="sm" showLabel={true} />
            </div>
            <div className="flex items-center gap-2">
              {onRegenerate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRegenerate}
                  className="gap-1"
                  data-testid="button-regenerate-methods"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={handleCopy}
                className="gap-1"
                data-testid="button-copy-methods"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
            </div>
          </div>
          <CardDescription>
            Methods section text generated from your Statistical Analysis Plan configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Primary:</span>
              <Badge variant="outline" className="text-xs">
                {primaryEndpoints.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Secondary:</span>
              <Badge variant="outline" className="text-xs">
                {secondaryEndpoints.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Tests:</span>
              <Badge variant="outline" className="text-xs">
                {config.selectedTests.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Alpha:</span>
              <Badge variant="outline" className="text-xs">
                {config.alphaLevel}
              </Badge>
            </div>
          </div>

          <Separator />

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="prose" data-testid="tab-prose">
                <FileText className="h-4 w-4 mr-2" />
                Prose Format
              </TabsTrigger>
              <TabsTrigger value="structured" data-testid="tab-structured">
                <BarChart3 className="h-4 w-4 mr-2" />
                Structured Format
              </TabsTrigger>
            </TabsList>
            <TabsContent value="prose" className="mt-4">
              <ScrollArea className="h-[400px] rounded-md border p-4 bg-muted/30">
                <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="text-methods-prose">
                  {proseText.split("\n\n").map((paragraph, idx) => (
                    <p key={idx} className="mb-4 text-sm leading-relaxed text-foreground">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="structured" className="mt-4">
              <ScrollArea className="h-[400px] rounded-md border p-4 bg-muted/30">
                <div className="space-y-4" data-testid="text-methods-structured">
                  {structuredText.split("\n\n").map((section, idx) => {
                    const [title, ...content] = section.split(": ");
                    return (
                      <div key={idx} className="space-y-1">
                        <h4 className="text-sm font-semibold text-ros-primary">{title}</h4>
                        <p className="text-sm text-foreground leading-relaxed">
                          {content.join(": ")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Configuration Summary
            </h4>
            <div className="grid gap-2 text-xs">
              <div className="flex flex-wrap gap-1">
                <span className="text-muted-foreground font-medium min-w-[100px]">Endpoints:</span>
                <span className="text-foreground">{formatEndpoints(config.endpoints)}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="text-muted-foreground font-medium min-w-[100px]">Tests:</span>
                <span className="text-foreground">{formatStatisticalTests(config.selectedTests)}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="text-muted-foreground font-medium min-w-[100px]">Covariates:</span>
                <span className="text-foreground">{formatCovariates(config.covariates)}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="text-muted-foreground font-medium min-w-[100px]">Significance:</span>
                <span className="text-foreground">{formatAlphaLevel(config.alphaLevel)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function StatisticalMethodsPreview({ config }: { config: SAPConfig }) {
  const proseText = generateMethodsProse(config);
  const firstParagraph = proseText.split("\n\n")[0] || "";
  const truncated = firstParagraph.length > 200 
    ? firstParagraph.slice(0, 200) + "..." 
    : firstParagraph;

  return (
    <Card className="border-muted">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Statistical Methods Preview</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {truncated}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
