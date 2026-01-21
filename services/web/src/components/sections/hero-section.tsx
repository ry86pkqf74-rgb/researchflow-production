import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Play, CheckCircle, Database, FileText, BarChart3, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export function HeroSection() {
  const miniStages = [
    { icon: Database, label: "Data", completed: true },
    { icon: FileText, label: "Literature", completed: true },
    { icon: BarChart3, label: "Analysis", completed: false },
    { icon: Sparkles, label: "Manuscript", completed: false },
  ];

  return (
    <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-gradient-to-br from-ros-primary/5 via-background to-ros-workflow/5 dark:from-ros-primary/10 dark:via-background dark:to-ros-workflow/10" data-testid="section-hero">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-ros-primary/10 via-transparent to-transparent" />
      <div className="absolute top-20 right-10 w-96 h-96 bg-ros-workflow/10 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-72 h-72 bg-ros-success/10 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-6 lg:px-24 py-16 lg:py-24 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <Badge variant="secondary" className="px-4 py-1.5 text-sm font-medium bg-ros-success/10 text-ros-success border-ros-success/20 dark:bg-ros-success/20" data-testid="badge-hero-tagline">
                Research Automation Platform
              </Badge>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-foreground" data-testid="text-hero-heading">
                Transform Research
                <span className="block text-ros-primary dark:text-ros-primary">Without Writing Code</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl" data-testid="text-hero-description">
                From data upload to manuscript draft in hours, not months. 
                An AI-powered platform designed for clinicians and biologists 
                who want to focus on science, not software.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="bg-ros-primary hover:bg-ros-primary/90 text-white px-8 py-6 text-lg font-semibold"
                data-testid="button-hero-demo"
                onClick={() => {
                  document.getElementById('try-demo')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                See Demo
                <Play className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="px-8 py-6 text-lg font-semibold border-2"
                data-testid="button-hero-learn-more"
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Learn More
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-feature-hipaa">
                <CheckCircle className="h-5 w-5 text-ros-success" />
                <span>HIPAA Compliant</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-feature-no-code">
                <CheckCircle className="h-5 w-5 text-ros-success" />
                <span>No Coding Required</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="text-feature-traceability">
                <CheckCircle className="h-5 w-5 text-ros-success" />
                <span>Full Traceability</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <Card className="p-6 lg:p-8 shadow-xl border-border/50 bg-card/80 backdrop-blur-sm" data-testid="card-hero-pipeline">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg" data-testid="text-pipeline-title">Research Pipeline</h3>
                  <Badge className="bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20" data-testid="badge-live-demo">
                    Live Demo
                  </Badge>
                </div>

                <div className="flex items-center justify-between gap-2">
                  {miniStages.map((stage, index) => (
                    <div key={index} className="flex flex-col items-center gap-2 flex-1" data-testid={`pipeline-stage-${index}`}>
                      <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center transition-all
                        ${stage.completed 
                          ? 'bg-ros-success/10 text-ros-success ring-2 ring-ros-success/30' 
                          : 'bg-muted text-muted-foreground'}
                      `}>
                        <stage.icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">{stage.label}</span>
                    </div>
                  ))}
                </div>

                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div 
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-ros-success to-ros-workflow rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "45%" }}
                    transition={{ duration: 1.5, delay: 0.5 }}
                    data-testid="progress-pipeline"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50" data-testid="stat-stages">
                    <p className="text-2xl font-bold text-ros-primary">12</p>
                    <p className="text-sm text-muted-foreground">Automated Stages</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50" data-testid="stat-time-saved">
                    <p className="text-2xl font-bold text-ros-success">85%</p>
                    <p className="text-sm text-muted-foreground">Time Saved</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-ros-primary/5 dark:bg-ros-primary/10 border border-ros-primary/20" data-testid="card-current-processing">
                  <p className="text-sm font-medium text-ros-primary">Currently Processing:</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Thyroid Clinical Dataset - 2,847 patient records
                  </p>
                </div>
              </div>
            </Card>

            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-ros-workflow/20 rounded-full blur-2xl" />
            <div className="absolute -top-4 -left-4 w-16 h-16 bg-ros-success/20 rounded-full blur-xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
