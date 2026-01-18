import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Sparkles, Loader2, FileText, BookOpen, Star, Building2,
  ChevronDown, ChevronUp, Lightbulb, Target, FlaskConical
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { GeneratedProposal } from "@packages/core/types";

interface GenerateResponse {
  status: string;
  topic: string;
  domain: string;
  proposals: GeneratedProposal[];
  generatedAt: string;
  mode: string;
}

const domains = [
  "Cardiology",
  "Oncology",
  "Neurology",
  "Endocrinology",
  "Pulmonology",
  "Rheumatology",
  "Nephrology",
  "Gastroenterology",
  "Infectious Disease",
  "Pediatrics",
  "General Medicine"
];

export function InteractiveDemo() {
  const [topic, setTopic] = useState("");
  const [domain, setDomain] = useState("");
  const [population, setPopulation] = useState("");
  const [outcome, setOutcome] = useState("");
  const [expandedProposal, setExpandedProposal] = useState<number | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/demo/generate-proposals", {
        topic,
        domain,
        population,
        outcome
      });
      return response.json() as Promise<GenerateResponse>;
    }
  });

  const handleGenerate = () => {
    if (topic.trim()) {
      generateMutation.mutate();
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-ros-success";
    if (score >= 80) return "text-ros-workflow";
    return "text-amber-500";
  };

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-muted/30 to-background" data-testid="section-interactive-demo">
      <div className="container mx-auto px-6 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4 px-4 py-1.5 bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20" data-testid="badge-demo-section">
            Try It Now
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-demo-heading">
            Generate Manuscript Ideas
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-demo-description">
            Enter your research topic and see how ROS generates tailored manuscript proposals with relevance scores and target journals.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-5 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-2"
          >
            <Card className="p-6 sticky top-24 z-[100]" data-testid="card-demo-form">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-ros-workflow/10 flex items-center justify-center">
                  <Lightbulb className="h-5 w-5 text-ros-workflow" />
                </div>
                <h3 className="text-lg font-semibold">Define Your Research</h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">Research Topic *</Label>
                  <Textarea
                    id="topic"
                    placeholder="e.g., Impact of GLP-1 receptor agonists on cardiovascular outcomes in Type 2 Diabetes"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="min-h-[80px] resize-none"
                    data-testid="input-research-topic"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="domain">Research Domain</Label>
                  <Select value={domain} onValueChange={setDomain}>
                    <SelectTrigger data-testid="select-domain">
                      <SelectValue placeholder="Select a domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {domains.map(d => (
                        <SelectItem key={d} value={d} data-testid={`select-item-${d.toLowerCase().replace(/\s+/g, '-')}`}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="population">Target Population</Label>
                  <Input
                    id="population"
                    placeholder="e.g., Adults 40-75 with established cardiovascular disease"
                    value={population}
                    onChange={(e) => setPopulation(e.target.value)}
                    data-testid="input-population"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="outcome">Primary Outcome</Label>
                  <Input
                    id="outcome"
                    placeholder="e.g., Major adverse cardiovascular events (MACE)"
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    data-testid="input-outcome"
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleGenerate}
                  disabled={!topic.trim() || generateMutation.isPending}
                  data-testid="button-generate-proposals"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Ideas...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Manuscript Ideas
                    </>
                  )}
                </Button>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-3"
          >
            {!generateMutation.data && !generateMutation.isPending && (
              <Card className="p-12 text-center border-dashed" data-testid="card-demo-placeholder">
                <FlaskConical className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-2">Ready to Generate</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Enter your research topic on the left and click generate to see AI-powered manuscript proposals.
                </p>
              </Card>
            )}

            {generateMutation.isPending && (
              <Card className="p-12 text-center" data-testid="card-demo-loading">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="w-16 h-16 mx-auto mb-4"
                >
                  <Sparkles className="h-16 w-16 text-ros-workflow" />
                </motion.div>
                <h3 className="text-lg font-medium mb-2">Analyzing Your Topic...</h3>
                <p className="text-muted-foreground">
                  ROS is generating tailored manuscript proposals based on your research criteria.
                </p>
              </Card>
            )}

            {generateMutation.data && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Generated Proposals</h3>
                    <p className="text-sm text-muted-foreground">
                      {generateMutation.data.proposals.length} manuscript ideas for "{generateMutation.data.topic}"
                    </p>
                  </div>
                  <Badge className="bg-ros-success/10 text-ros-success border-ros-success/20">
                    {generateMutation.data.mode} Mode
                  </Badge>
                </div>

                <AnimatePresence mode="popLayout">
                  {generateMutation.data.proposals.map((proposal, index) => (
                    <motion.div
                      key={proposal.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card 
                        className={`p-5 cursor-pointer transition-all ${
                          expandedProposal === proposal.id ? 'ring-2 ring-ros-workflow' : 'hover-elevate'
                        }`}
                        onClick={() => setExpandedProposal(
                          expandedProposal === proposal.id ? null : proposal.id
                        )}
                        data-testid={`card-proposal-${proposal.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary" className="text-xs">
                                Proposal #{proposal.id}
                              </Badge>
                              <div className="flex items-center gap-1">
                                <Star className={`h-3 w-3 ${getScoreColor(proposal.relevanceScore)}`} />
                                <span className={`text-xs font-medium ${getScoreColor(proposal.relevanceScore)}`}>
                                  {proposal.relevanceScore}% relevant
                                </span>
                              </div>
                            </div>
                            <h4 className="font-semibold mb-2" data-testid={`text-proposal-title-${proposal.id}`}>
                              {proposal.title}
                            </h4>
                            <p className={`text-sm text-muted-foreground ${
                              expandedProposal === proposal.id ? '' : 'line-clamp-2'
                            }`}>
                              {proposal.abstract}
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            {expandedProposal === proposal.id ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedProposal === proposal.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="mt-4 pt-4 border-t"
                            >
                              <div className="grid md:grid-cols-3 gap-4 mb-4">
                                <div className="p-3 rounded-lg bg-muted/50">
                                  <div className="text-xs text-muted-foreground mb-1">Relevance</div>
                                  <div className={`text-2xl font-bold ${getScoreColor(proposal.relevanceScore)}`}>
                                    {proposal.relevanceScore}%
                                  </div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                  <div className="text-xs text-muted-foreground mb-1">Novelty</div>
                                  <div className={`text-2xl font-bold ${getScoreColor(proposal.noveltyScore)}`}>
                                    {proposal.noveltyScore}%
                                  </div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                  <div className="text-xs text-muted-foreground mb-1">Feasibility</div>
                                  <div className={`text-2xl font-bold ${getScoreColor(proposal.feasibilityScore)}`}>
                                    {proposal.feasibilityScore}%
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Target className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Methodology</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{proposal.methodology}</p>
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Target Journals</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {proposal.suggestedJournals.map((journal, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        <BookOpen className="h-3 w-3 mr-1" />
                                        {journal}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Keywords</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {proposal.keywords.map((keyword, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs">
                                        {keyword}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-2 mt-4">
                                <Button size="sm" data-testid={`button-select-proposal-${proposal.id}`}>
                                  Select This Proposal
                                </Button>
                                <Button size="sm" variant="outline" data-testid={`button-refine-proposal-${proposal.id}`}>
                                  Refine Further
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
