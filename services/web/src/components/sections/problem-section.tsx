import { Card } from "@/components/ui/card";
import { Clock, Code, FileWarning, Users } from "lucide-react";
import { motion } from "framer-motion";

const problems = [
  {
    icon: Clock,
    title: "Months of Manual Work",
    description: "Traditional research workflows require weeks of literature review, data cleaning, and statistical analysis before any meaningful results emerge.",
    stat: "6-12 months",
    statLabel: "average time to publication"
  },
  {
    icon: Code,
    title: "Technical Barriers",
    description: "Most research tools require programming skills in R, Python, or SAS—creating barriers for clinicians and biologists without coding experience.",
    stat: "73%",
    statLabel: "of researchers lack coding skills"
  },
  {
    icon: FileWarning,
    title: "Compliance Complexity",
    description: "Ensuring HIPAA compliance, data validation, and maintaining audit trails manually is error-prone and time-consuming.",
    stat: "40%",
    statLabel: "of time spent on compliance"
  },
  {
    icon: Users,
    title: "Collaboration Friction",
    description: "Sharing data, methods, and results across research teams often requires complex file management and version control.",
    stat: "25+",
    statLabel: "emails per research project"
  }
];

export function ProblemSection() {
  return (
    <section className="py-16 lg:py-24 bg-muted/30" data-testid="section-problem">
      <div className="container mx-auto px-6 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 lg:mb-16"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-problem-heading">
            Research Shouldn't Be This Hard
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-problem-description">
            Clinical and biomedical researchers face significant barriers that slow discovery and limit impact.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="grid-problems">
          {problems.map((problem, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="p-6 h-full border-border/50 hover-elevate" data-testid={`card-problem-${index}`}>
                <div className="w-12 h-12 rounded-lg bg-ros-alert/10 text-ros-alert flex items-center justify-center mb-4">
                  <problem.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-lg mb-2" data-testid={`text-problem-title-${index}`}>{problem.title}</h3>
                <p className="text-sm text-muted-foreground mb-4" data-testid={`text-problem-desc-${index}`}>{problem.description}</p>
                <div className="pt-4 border-t border-border">
                  <p className="text-2xl font-bold text-ros-alert" data-testid={`text-problem-stat-${index}`}>{problem.stat}</p>
                  <p className="text-xs text-muted-foreground" data-testid={`text-problem-label-${index}`}>{problem.statLabel}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
