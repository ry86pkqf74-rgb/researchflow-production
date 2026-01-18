import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Clock, Zap, ArrowRight, Calendar, FileText, ClipboardCheck,
  Database, Calculator, FileEdit, Send
} from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

const stepIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  topic: FileText,
  irb: ClipboardCheck,
  "data-prep": Database,
  analysis: Calculator,
  manuscript: FileEdit,
  revision: Send
};

interface TimelineStep {
  id: string;
  name: string;
  traditionalDuration: string;
  rosDuration: string;
  traditionalDays: number;
  rosDays: number;
  description: string;
}

interface TimelineData {
  steps: TimelineStep[];
  traditional: {
    totalDays: number;
    label: string;
  };
  ros: {
    totalDays: number;
    label: string;
  };
}

export function TimelineComparison() {
  const { data: timeline, isLoading } = useQuery<TimelineData>({
    queryKey: ["/api/timeline/comparison"],
  });

  if (isLoading) {
    return (
      <section className="py-16 lg:py-24" data-testid="section-timeline-loading">
        <div className="container mx-auto px-6 lg:px-24">
          <Skeleton className="h-96 w-full" />
        </div>
      </section>
    );
  }

  if (!timeline) return null;

  const maxTraditionalDays = Math.max(...timeline.steps.map(s => s.traditionalDays));

  return (
    <section className="py-16 lg:py-24 bg-gradient-to-b from-background to-muted/30" data-testid="section-timeline">
      <div className="container mx-auto px-6 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4 px-4 py-1.5 bg-ros-success/10 text-ros-success border-ros-success/20" data-testid="badge-timeline-section">
            Time Savings
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-timeline-heading">
            Traditional vs. ROS Timeline
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-timeline-description">
            See how ROS transforms a 6-12 month research process into less than 2 hours of automated work.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-6 h-full border-ros-alert/30 dark:border-ros-alert/20" data-testid="card-traditional-timeline">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-ros-alert/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-ros-alert" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Traditional Research</h3>
                  <p className="text-muted-foreground text-sm">Manual processes and waiting periods</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-xl bg-ros-alert/5 mb-6">
                <div>
                  <div className="text-sm text-muted-foreground">Total Time</div>
                  <div className="text-3xl font-bold text-ros-alert">{timeline.traditional.label}</div>
                </div>
                <Calendar className="h-10 w-10 text-ros-alert/30" />
              </div>

              <div className="space-y-4">
                {timeline.steps.map((step, index) => {
                  const StepIcon = stepIcons[step.id] || FileText;
                  const barWidth = (step.traditionalDays / maxTraditionalDays) * 100;
                  
                  return (
                    <motion.div 
                      key={step.id}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className="space-y-2"
                      data-testid={`timeline-step-traditional-${step.id}`}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <StepIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{step.name}</span>
                        </div>
                        <span className="text-ros-alert font-semibold">{step.traditionalDuration}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-ros-alert/70 rounded-full"
                          initial={{ width: 0 }}
                          whileInView={{ width: `${barWidth}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.8, delay: index * 0.1 }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="p-6 h-full border-ros-success/30" data-testid="card-ros-timeline">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-ros-success/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-ros-success" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">ROS Automated</h3>
                  <p className="text-muted-foreground text-sm">AI-powered research pipeline</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-xl bg-ros-success/5 mb-6">
                <div>
                  <div className="text-sm text-muted-foreground">Total Time</div>
                  <div className="text-3xl font-bold text-ros-success">{timeline.ros.label}</div>
                </div>
                <Zap className="h-10 w-10 text-ros-success/30" />
              </div>

              <div className="space-y-4">
                {timeline.steps.map((step, index) => {
                  const StepIcon = stepIcons[step.id] || FileText;
                  
                  return (
                    <motion.div 
                      key={step.id}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className="space-y-2"
                      data-testid={`timeline-step-ros-${step.id}`}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <StepIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{step.name}</span>
                        </div>
                        <span className="text-ros-success font-semibold">{step.rosDuration}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-ros-success rounded-full"
                          initial={{ width: 0 }}
                          whileInView={{ width: "100%" }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.4, delay: index * 0.1 }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center"
        >
          <Card className="inline-flex items-center gap-6 p-6 bg-gradient-to-r from-ros-primary/10 via-ros-workflow/10 to-ros-success/10" data-testid="card-time-savings-summary">
            <div className="text-left">
              <div className="text-sm text-muted-foreground">Time Reduction</div>
              <div className="text-4xl font-bold text-ros-success">99.5%</div>
            </div>
            <ArrowRight className="h-8 w-8 text-muted-foreground" />
            <div className="text-left">
              <div className="text-sm text-muted-foreground">From</div>
              <div className="text-2xl font-semibold line-through text-ros-alert/70">{timeline.traditional.label}</div>
            </div>
            <ArrowRight className="h-8 w-8 text-muted-foreground" />
            <div className="text-left">
              <div className="text-sm text-muted-foreground">To</div>
              <div className="text-2xl font-semibold text-ros-success">{timeline.ros.label}</div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
