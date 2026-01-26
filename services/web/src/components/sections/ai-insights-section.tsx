import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Sparkles, Brain, BookOpen, FileText } from "lucide-react";
import { AIInsightsPanel } from "@/components/ai-insights-panel";

export function AIInsightsSection() {
  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-muted/30 via-background to-muted/30" data-testid="section-ai-insights">
      <div className="container mx-auto px-6 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4 px-4 py-1.5 bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20" data-testid="badge-ai-section">
            AI-Powered Research
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-ai-heading">
            Intelligent Research Assistant
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Experience real-time AI analysis: from structured PICO research briefs to evidence gap maps,
            manuscript ideation with 5-10 study proposals, and target journal recommendations with acceptance likelihood.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid lg:grid-cols-4 gap-6 mb-12"
        >
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-xl bg-ros-primary/10 flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-ros-primary" />
            </div>
            <h3 className="font-semibold mb-1">PICO Research Brief</h3>
            <p className="text-sm text-muted-foreground">Structured study objectives with clarifying prompts</p>
          </div>
          
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-xl bg-ros-success/10 flex items-center justify-center mb-3">
              <Brain className="h-6 w-6 text-ros-success" />
            </div>
            <h3 className="font-semibold mb-1">Evidence Gap Map</h3>
            <p className="text-sm text-muted-foreground">Known findings, unknowns, and research opportunities</p>
          </div>
          
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-xl bg-ros-workflow/10 flex items-center justify-center mb-3">
              <Sparkles className="h-6 w-6 text-ros-workflow" />
            </div>
            <h3 className="font-semibold mb-1">5-10 Study Cards</h3>
            <p className="text-sm text-muted-foreground">AI-generated manuscript proposals with feasibility scores</p>
          </div>
          
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
              <BookOpen className="h-6 w-6 text-amber-600" />
            </div>
            <h3 className="font-semibold mb-1">Journal Targeting</h3>
            <p className="text-sm text-muted-foreground">3 journals per study with acceptance likelihood and impact factors</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          <AIInsightsPanel />
        </motion.div>
      </div>
    </section>
  );
}
