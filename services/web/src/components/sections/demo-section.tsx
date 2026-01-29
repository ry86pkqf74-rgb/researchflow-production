import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Upload, FileSpreadsheet, Check, Clock, 
  BarChart3, FileText, Sparkles
} from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

interface DemoStep {
  id: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "completed" | "active" | "pending";
  output: { type: string; items?: string[]; preview?: string } | null;
}

const demoSteps: DemoStep[] = [
  {
    id: 1,
    title: "Upload Dataset",
    description: "Drag and drop your clinical data file",
    icon: Upload,
    status: "completed",
    output: null
  },
  {
    id: 2,
    title: "PHI Scanning",
    description: "Automatic detection of protected health information",
    icon: FileSpreadsheet,
    status: "completed",
    output: {
      type: "scan",
      items: ["0 names detected", "0 SSNs detected", "3 dates flagged (de-identified)", "0 locations detected"]
    }
  },
  {
    id: 3,
    title: "Baseline Characteristics",
    description: "Generate Table 1 demographics",
    icon: BarChart3,
    status: "completed",
    output: {
      type: "table",
      preview: "2,847 patients | 8 variables | p-values calculated"
    }
  },
  {
    id: 4,
    title: "Literature Analysis",
    description: "AI-powered research gap identification",
    icon: FileText,
    status: "active",
    output: null
  },
  {
    id: 5,
    title: "Manuscript Proposals",
    description: "Generate 5-10 novel research ideas",
    icon: Sparkles,
    status: "pending",
    output: null
  }
];

export function DemoSection() {
  const [, setCurrentStep] = useState(4);
  const [isFileHovered, setIsFileHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: datasetInfo } = useQuery<{
    id: string;
    name: string;
    type: string;
    records: number;
    variables: number;
    description: string;
  }>({
    queryKey: ["/api/demo/dataset"],
  });

  return (
    <section className="py-16 lg:py-24" data-testid="section-demo">
      <div className="container mx-auto px-6 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 lg:mb-16"
        >
          <Badge variant="secondary" className="mb-4 px-4 py-1.5 bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20" data-testid="badge-demo-section">
            See It In Action
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-demo-heading">
            Thyroid Research Demo
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-demo-description">
            Watch how ResearchFlow transforms a clinical thyroid dataset into actionable
            research insights and manuscript proposals.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-6 lg:p-8 border-border/50 h-full" data-testid="card-demo-progress">
              <h3 className="font-semibold text-lg mb-6" data-testid="text-progress-title">Demo Progress</h3>
              
              <div className="space-y-4" data-testid="list-demo-steps">
                {demoSteps.map((step, index) => (
                  <div key={step.id} className="relative">
                    <div 
                      className={`
                        flex items-start gap-4 p-4 rounded-xl transition-all cursor-pointer
                        ${step.status === 'active' ? 'bg-ros-workflow/5 border border-ros-workflow/20' : ''}
                        ${step.status === 'completed' ? 'bg-ros-success/5' : ''}
                        ${step.status === 'pending' ? 'opacity-50' : ''}
                      `}
                      onClick={() => step.status !== 'pending' && setCurrentStep(step.id)}
                      data-testid={`button-demo-step-${step.id}`}
                    >
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                        ${step.status === 'completed' ? 'bg-ros-success text-white' : ''}
                        ${step.status === 'active' ? 'bg-ros-workflow text-white animate-pulse' : ''}
                        ${step.status === 'pending' ? 'bg-muted text-muted-foreground' : ''}
                      `}>
                        {step.status === 'completed' ? (
                          <Check className="h-5 w-5" />
                        ) : (
                          <step.icon className="h-5 w-5" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium" data-testid={`text-step-title-${step.id}`}>{step.title}</h4>
                          {step.status === 'active' && (
                            <Badge className="bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20" data-testid={`badge-step-status-${step.id}`}>
                              Processing
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1" data-testid={`text-step-desc-${step.id}`}>{step.description}</p>
                        
                        {step.output && step.status === 'completed' && (
                          <div className="mt-3 p-3 rounded-lg bg-card border border-border/50" data-testid={`output-step-${step.id}`}>
                            {step.output.type === 'scan' && step.output.items && (
                              <div className="grid grid-cols-2 gap-2">
                                {step.output.items.map((item, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs" data-testid={`scan-result-${step.id}-${i}`}>
                                    <Check className="h-3 w-3 text-ros-success" />
                                    <span>{item}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {step.output.type === 'table' && step.output.preview && (
                              <div className="flex items-center gap-2 text-sm" data-testid={`table-preview-${step.id}`}>
                                <BarChart3 className="h-4 w-4 text-ros-primary" />
                                <span>{step.output.preview}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {index < demoSteps.length - 1 && (
                      <div className={`
                        absolute left-9 top-14 w-0.5 h-4
                        ${step.status === 'completed' ? 'bg-ros-success' : 'bg-border'}
                      `} />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <Card 
              className={`
                p-8 border-2 border-dashed transition-all
                ${isFileHovered ? 'border-ros-primary bg-ros-primary/5' : 'border-border'}
              `}
              onDragOver={(e) => { e.preventDefault(); setIsFileHovered(true); }}
              onDragLeave={() => setIsFileHovered(false)}
              onDrop={(e) => { e.preventDefault(); setIsFileHovered(false); }}
              data-testid="dropzone-upload"
            >
              <div className="flex flex-col items-center justify-center text-center py-8">
                <div className={`
                  w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors
                  ${isFileHovered ? 'bg-ros-primary/10 text-ros-primary' : 'bg-muted text-muted-foreground'}
                `}>
                  <Upload className="h-8 w-8" />
                </div>
                <h3 className="font-semibold text-lg mb-2" data-testid="text-upload-title">Upload Your Dataset</h3>
                <p className="text-sm text-muted-foreground mb-4" data-testid="text-upload-description">
                  Drag and drop a CSV, Excel, or SPSS file
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.sav"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // TODO: Implement file upload logic
                      console.log('File selected:', file.name);
                      // Navigate to workflow with uploaded file
                      window.location.href = '/workflow';
                    }
                  }}
                />
                <Button 
                  variant="outline" 
                  className="mb-2"
                  data-testid="button-browse-files"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Browse Files
                </Button>
                <p className="text-xs text-muted-foreground" data-testid="text-upload-limit">
                  Max file size: 100MB
                </p>
              </div>
            </Card>

            <Card className="p-6 border-border/50 bg-ros-primary/5" data-testid="card-loaded-dataset">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-ros-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="h-6 w-6 text-ros-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium" data-testid="text-dataset-name">{datasetInfo?.name || "thyroid_clinical_data.csv"}</h4>
                    <Badge className="bg-ros-success/10 text-ros-success border-ros-success/20" data-testid="badge-dataset-status">
                      Loaded
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid="text-dataset-info">
                    {datasetInfo?.records || 2847} patient records | {datasetInfo?.variables || 24} variables | 156 KB
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6 border-border/50" data-testid="card-time-comparison">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium" data-testid="text-comparison-title">Time Comparison</h4>
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-4">
                <div data-testid="comparison-traditional">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Traditional Workflow</span>
                    <span className="text-sm font-medium text-ros-alert">6-8 months</span>
                  </div>
                  <div className="h-3 bg-ros-alert/20 rounded-full overflow-hidden">
                    <div className="h-full bg-ros-alert w-full" />
                  </div>
                </div>
                <div data-testid="comparison-researchops">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">With ResearchFlow</span>
                    <span className="text-sm font-medium text-ros-success">2-4 hours</span>
                  </div>
                  <div className="h-3 bg-ros-success/20 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-ros-success"
                      initial={{ width: "0%" }}
                      whileInView={{ width: "8%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4 text-center" data-testid="text-comparison-result">
                <span className="font-semibold text-ros-success">99% faster</span> from data to manuscript draft
              </p>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
