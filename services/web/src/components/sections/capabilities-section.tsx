import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Search, Lightbulb, Check, Star, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import type { ManuscriptProposal, ResearchCapability, BaselineCharacteristic } from "@packages/core/types";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BarChart3, Search, Lightbulb
};

const researchCapabilities: ResearchCapability[] = [
  {
    id: "baseline",
    title: "Baseline Characteristics Generation",
    description: "Automatically generate publication-ready Table 1 demographics and summary statistics from your dataset with proper formatting and statistical testing.",
    features: [
      "Automatic variable type detection",
      "Stratified group comparisons",
      "P-value calculations",
      "Publication-ready formatting",
      "Missing data handling"
    ],
    icon: "BarChart3"
  },
  {
    id: "literature",
    title: "Literature Gap Analysis",
    description: "AI-powered analysis of existing literature to identify unexplored research questions, methodological gaps, and opportunities for novel contributions.",
    features: [
      "Semantic paper clustering",
      "Citation network analysis",
      "Methodology gap detection",
      "Trend identification",
      "Collaboration opportunities"
    ],
    icon: "Search"
  },
  {
    id: "manuscript",
    title: "AI-Assisted Manuscript Ideation",
    description: "Generate 5-10 novel manuscript proposals based on your data, with relevance scoring, target journal suggestions, and feasibility assessments.",
    features: [
      "Multiple proposal generation",
      "Novelty scoring algorithm",
      "Journal matching",
      "Abstract drafting",
      "Keyword optimization"
    ],
    icon: "Lightbulb"
  }
];

export function CapabilitiesSection() {
  const [expandedProposal, setExpandedProposal] = useState<number | null>(1);

  const { data: baselineData, isLoading: isLoadingBaseline } = useQuery<{
    dataset: any;
    characteristics: BaselineCharacteristic[];
    totalPatients: number;
    groups: { group1: { name: string; count: number }; group2: { name: string; count: number } };
  }>({
    queryKey: ["/api/analysis/baseline"],
  });

  const { data: manuscriptProposals, isLoading: isLoadingProposals } = useQuery<ManuscriptProposal[]>({
    queryKey: ["/api/manuscripts/proposals"],
  });

  return (
    <section className="py-16 lg:py-24" data-testid="section-capabilities">
      <div className="container mx-auto px-6 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 lg:mb-16"
        >
          <Badge variant="secondary" className="mb-4 px-4 py-1.5 bg-ros-primary/10 text-ros-primary border-ros-primary/20" data-testid="badge-capabilities-section">
            Key Capabilities
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-capabilities-heading">
            Automated Research Intelligence
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-capabilities-description">
            Powerful AI-driven features that transform raw data into publishable research insights.
          </p>
        </motion.div>

        <Tabs defaultValue="baseline" className="w-full" data-testid="tabs-capabilities">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-3 mb-8" data-testid="tablist-capabilities">
            {researchCapabilities.map((cap) => {
              const IconComponent = iconMap[cap.icon] || BarChart3;
              return (
                <TabsTrigger 
                  key={cap.id} 
                  value={cap.id}
                  className="flex items-center gap-2 data-[state=active]:bg-ros-primary data-[state=active]:text-white"
                  data-testid={`tab-${cap.id}`}
                >
                  <IconComponent className="h-4 w-4" />
                  <span className="hidden sm:inline">{cap.title.split(' ')[0]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="baseline" data-testid="tabcontent-baseline">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-6 lg:p-8 border-border/50" data-testid="card-baseline">
                <div className="grid lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-4">
                    <div className="w-14 h-14 rounded-xl bg-ros-primary/10 text-ros-primary flex items-center justify-center">
                      <BarChart3 className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-semibold" data-testid="text-baseline-title">{researchCapabilities[0].title}</h3>
                    <p className="text-muted-foreground" data-testid="text-baseline-description">{researchCapabilities[0].description}</p>
                    <div className="space-y-2" data-testid="list-baseline-features">
                      {researchCapabilities[0].features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm" data-testid={`feature-baseline-${index}`}>
                          <Check className="h-4 w-4 text-ros-success" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-2">
                    {isLoadingBaseline ? (
                      <div className="space-y-4">
                        <Skeleton className="h-8 w-full" />
                        {[...Array(8)].map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : (
                      <div className="bg-muted/50 rounded-xl p-4 overflow-x-auto" data-testid="table-baseline-container">
                        <div className="text-sm font-medium mb-4 flex items-center justify-between">
                          <span data-testid="text-table-title">Table 1: Baseline Characteristics</span>
                          <Badge variant="secondary" data-testid="badge-auto-generated">Auto-generated</Badge>
                        </div>
                        <table className="w-full text-sm" data-testid="table-baseline">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-3 font-medium">Variable</th>
                              <th className="text-center py-2 px-3 font-medium">Overall<br/>(N={baselineData?.totalPatients || 2847})</th>
                              <th className="text-center py-2 px-3 font-medium">{baselineData?.groups.group1.name || "Group 1"}<br/>(N={baselineData?.groups.group1.count || 1416})</th>
                              <th className="text-center py-2 px-3 font-medium">{baselineData?.groups.group2.name || "Group 2"}<br/>(N={baselineData?.groups.group2.count || 1431})</th>
                              <th className="text-center py-2 px-3 font-medium">P-value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(baselineData?.characteristics || []).map((row, index) => (
                              <tr key={index} className="border-b border-border/50 hover:bg-muted/30" data-testid={`row-baseline-${index}`}>
                                <td className="py-2 px-3">{row.variable}</td>
                                <td className="text-center py-2 px-3">{row.overall}</td>
                                <td className="text-center py-2 px-3">{row.group1}</td>
                                <td className="text-center py-2 px-3">{row.group2}</td>
                                <td className={`text-center py-2 px-3 font-medium ${
                                  parseFloat(row.pValue) < 0.05 || row.pValue.includes('<') 
                                    ? 'text-ros-alert' 
                                    : ''
                                }`}>{row.pValue}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="literature" data-testid="tabcontent-literature">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-6 lg:p-8 border-border/50" data-testid="card-literature">
                <div className="grid lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-4">
                    <div className="w-14 h-14 rounded-xl bg-ros-success/10 text-ros-success flex items-center justify-center">
                      <Search className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-semibold" data-testid="text-literature-title">{researchCapabilities[1].title}</h3>
                    <p className="text-muted-foreground" data-testid="text-literature-description">{researchCapabilities[1].description}</p>
                    <div className="space-y-2" data-testid="list-literature-features">
                      {researchCapabilities[1].features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm" data-testid={`feature-literature-${index}`}>
                          <Check className="h-4 w-4 text-ros-success" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="p-4 bg-muted/50 border-border/50" data-testid="stat-papers-analyzed">
                        <p className="text-3xl font-bold text-ros-primary">247</p>
                        <p className="text-sm text-muted-foreground">Papers Analyzed</p>
                      </Card>
                      <Card className="p-4 bg-muted/50 border-border/50" data-testid="stat-gaps-found">
                        <p className="text-3xl font-bold text-ros-success">12</p>
                        <p className="text-sm text-muted-foreground">Research Gaps Found</p>
                      </Card>
                    </div>
                    
                    <div className="bg-muted/50 rounded-xl p-4 space-y-3" data-testid="list-research-gaps">
                      <p className="text-sm font-medium">Identified Research Gaps:</p>
                      {[
                        { gap: "Long-term cardiovascular outcomes in subclinical hypothyroidism", priority: "High" },
                        { gap: "Machine learning applications in thyroid nodule assessment", priority: "High" },
                        { gap: "Gender-specific treatment response patterns", priority: "Medium" },
                        { gap: "Impact of levothyroxine timing on metabolic outcomes", priority: "Medium" }
                      ].map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-card" data-testid={`card-gap-${index}`}>
                          <span className="text-sm">{item.gap}</span>
                          <Badge className={item.priority === "High" ? "bg-ros-alert/10 text-ros-alert" : "bg-ros-workflow/10 text-ros-workflow"} data-testid={`badge-priority-${index}`}>
                            {item.priority}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="manuscript" data-testid="tabcontent-manuscript">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-6 lg:p-8 border-border/50" data-testid="card-manuscript">
                <div className="grid lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-4">
                    <div className="w-14 h-14 rounded-xl bg-ros-workflow/10 text-ros-workflow flex items-center justify-center">
                      <Lightbulb className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-semibold" data-testid="text-manuscript-title">{researchCapabilities[2].title}</h3>
                    <p className="text-muted-foreground" data-testid="text-manuscript-description">{researchCapabilities[2].description}</p>
                    <div className="space-y-2" data-testid="list-manuscript-features">
                      {researchCapabilities[2].features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm" data-testid={`feature-manuscript-${index}`}>
                          <Check className="h-4 w-4 text-ros-success" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-3" data-testid="list-proposals">
                    {isLoadingProposals ? (
                      [...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))
                    ) : (
                      (manuscriptProposals || []).map((proposal) => (
                        <div
                          key={proposal.id}
                          className={`
                            p-4 rounded-xl border transition-all cursor-pointer
                            ${expandedProposal === proposal.id 
                              ? 'bg-card border-ros-workflow/50 shadow-sm' 
                              : 'bg-muted/50 border-border/50 hover:bg-muted'}
                          `}
                          onClick={() => setExpandedProposal(expandedProposal === proposal.id ? null : proposal.id)}
                          data-testid={`card-proposal-${proposal.id}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-ros-workflow" data-testid={`text-proposal-number-${proposal.id}`}>Proposal {proposal.id}</span>
                                <div className="flex items-center gap-1">
                                  <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                  <span className="text-xs" data-testid={`text-proposal-score-${proposal.id}`}>{proposal.relevanceScore}%</span>
                                </div>
                              </div>
                              <h4 className="font-medium text-sm" data-testid={`text-proposal-title-${proposal.id}`}>{proposal.title}</h4>
                            </div>
                            <ArrowRight className={`h-5 w-5 text-muted-foreground transition-transform ${expandedProposal === proposal.id ? 'rotate-90' : ''}`} />
                          </div>

                          {expandedProposal === proposal.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              transition={{ duration: 0.2 }}
                              className="mt-4 pt-4 border-t border-border space-y-4"
                              data-testid={`proposal-details-${proposal.id}`}
                            >
                              <p className="text-sm text-muted-foreground" data-testid={`text-proposal-abstract-${proposal.id}`}>{proposal.abstract}</p>
                              
                              <div className="grid grid-cols-3 gap-4" data-testid={`stats-proposal-${proposal.id}`}>
                                <div className="text-center p-2 rounded-lg bg-muted">
                                  <p className="text-lg font-bold text-ros-success">{proposal.noveltyScore}%</p>
                                  <p className="text-xs text-muted-foreground">Novelty</p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-muted">
                                  <p className="text-lg font-bold text-ros-primary">{proposal.relevanceScore}%</p>
                                  <p className="text-xs text-muted-foreground">Relevance</p>
                                </div>
                                <div className="text-center p-2 rounded-lg bg-muted">
                                  <p className="text-lg font-bold text-ros-workflow">{proposal.feasibilityScore}%</p>
                                  <p className="text-xs text-muted-foreground">Feasibility</p>
                                </div>
                              </div>

                              <div>
                                <p className="text-xs font-medium mb-2">Suggested Journals:</p>
                                <div className="flex flex-wrap gap-2" data-testid={`journals-proposal-${proposal.id}`}>
                                  {proposal.suggestedJournals.map((journal, index) => (
                                    <Badge key={index} variant="secondary" className="text-xs" data-testid={`badge-journal-${proposal.id}-${index}`}>
                                      {journal}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              <Button size="sm" className="w-full bg-ros-workflow hover:bg-ros-workflow/90" data-testid={`button-develop-proposal-${proposal.id}`}>
                                Develop This Proposal
                              </Button>
                            </motion.div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
