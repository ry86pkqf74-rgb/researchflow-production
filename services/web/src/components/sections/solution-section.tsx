import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Shield, Brain, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const solutions = [
  {
    icon: Zap,
    title: "Automated Pipeline",
    description: "12-stage research workflow from data upload to manuscript draft, all automated with AI assistance.",
    highlight: "Hours, not months",
    color: "ros-primary"
  },
  {
    icon: Shield,
    title: "Governance-First",
    description: "Built-in HIPAA compliance, PHI scanning, and complete audit trails for every data operation.",
    highlight: "100% compliant",
    color: "ros-success"
  },
  {
    icon: Brain,
    title: "AI-Powered Insights",
    description: "Generate manuscript proposals, identify literature gaps, and receive statistical recommendations automatically.",
    highlight: "5-10 proposals",
    color: "ros-workflow"
  }
];

export function SolutionSection() {
  return (
    <section className="py-16 lg:py-24" data-testid="section-solution">
      <div className="container mx-auto px-6 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 lg:mb-16"
        >
          <Badge variant="secondary" className="mb-4 px-4 py-1.5 bg-ros-success/10 text-ros-success border-ros-success/20" data-testid="badge-solution-section">
            The Solution
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-solution-heading">
            Research Operations System
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-solution-description">
            A complete platform that transforms complex research workflows into an accessible, 
            automated experience for non-technical researchers.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8" data-testid="grid-solutions">
          {solutions.map((solution, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="p-8 h-full border-border/50 hover-elevate group relative overflow-visible" data-testid={`card-solution-${index}`}>
                <div className={`
                  w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-105
                  ${solution.color === 'ros-primary' ? 'bg-ros-primary/10 text-ros-primary' : ''}
                  ${solution.color === 'ros-success' ? 'bg-ros-success/10 text-ros-success' : ''}
                  ${solution.color === 'ros-workflow' ? 'bg-ros-workflow/10 text-ros-workflow' : ''}
                `}>
                  <solution.icon className="h-7 w-7" />
                </div>
                
                <h3 className="font-semibold text-xl mb-3" data-testid={`text-solution-title-${index}`}>{solution.title}</h3>
                <p className="text-muted-foreground mb-6" data-testid={`text-solution-desc-${index}`}>{solution.description}</p>
                
                <div className={`
                  inline-flex items-center px-4 py-2 rounded-full text-sm font-medium
                  ${solution.color === 'ros-primary' ? 'bg-ros-primary/10 text-ros-primary' : ''}
                  ${solution.color === 'ros-success' ? 'bg-ros-success/10 text-ros-success' : ''}
                  ${solution.color === 'ros-workflow' ? 'bg-ros-workflow/10 text-ros-workflow' : ''}
                `} data-testid={`badge-solution-highlight-${index}`}>
                  {solution.highlight}
                </div>

                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
