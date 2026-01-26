import { useState } from "react";
import { safeLocaleString } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Activity, Heart, Microscope, Brain, Droplets, Wind, Bone, 
  Database, FileText, Calendar, Shield, ChevronRight, Search, AlertTriangle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import type { ResearchDataset } from "@packages/core/types";
import { Input } from "@/components/ui/input";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Activity, Heart, Microscope, Brain, Droplets, Wind, Bone, Database
};

const colorMap: Record<string, string> = {
  "ros-primary": "bg-ros-primary/10 text-ros-primary border-ros-primary/20",
  "red-500": "bg-ros-alert/10 text-ros-alert border-ros-alert/20",
  "pink-500": "bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20",
  "purple-500": "bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20",
  "amber-500": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  "cyan-500": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  "orange-500": "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  "emerald-500": "bg-ros-success/10 text-ros-success border-ros-success/20"
};

export function DatasetLibrary() {
  const { data: datasets, isLoading } = useQuery<ResearchDataset[]>({
    queryKey: ["/api/datasets"],
  });

  const [selectedDataset, setSelectedDataset] = useState<ResearchDataset | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const domains = datasets ? Array.from(new Set(datasets.map(d => d.domain))) : [];
  
  const filteredDatasets = datasets?.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          d.domain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDomain = !selectedDomain || d.domain === selectedDomain;
    return matchesSearch && matchesDomain;
  });

  if (isLoading) {
    return (
      <section className="py-16 lg:py-24 bg-muted/30" data-testid="section-datasets-loading">
        <div className="container mx-auto px-6 lg:px-24">
          <div className="text-center mb-12">
            <Skeleton className="h-8 w-32 mx-auto mb-4" />
            <Skeleton className="h-12 w-96 mx-auto mb-4" />
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 lg:py-24 bg-muted/30" data-testid="section-datasets">
      <div className="container mx-auto px-6 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="mb-4 px-4 py-1.5 bg-ros-primary/10 text-ros-primary border-ros-primary/20" data-testid="badge-datasets-section">
            Sample Datasets
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-datasets-heading">
            Research Domain Library
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-datasets-description">
            Explore pre-configured datasets across multiple medical specialties. Each dataset is de-identified and ready for research analysis.
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search datasets by name, domain, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-dataset-search"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedDomain === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDomain(null)}
              data-testid="button-filter-all"
            >
              All Domains
            </Button>
            {domains.map(domain => (
              <Button
                key={domain}
                variant={selectedDomain === domain ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDomain(domain)}
                data-testid={`button-filter-${domain.toLowerCase()}`}
              >
                {domain}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredDatasets?.map((dataset, index) => {
              const IconComponent = iconMap[dataset.icon] || Database;
              const colorClass = colorMap[dataset.color] || colorMap["ros-primary"];
              
              return (
                <motion.div
                  key={dataset.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <Card 
                    className={`p-5 cursor-pointer transition-all hover-elevate ${
                      selectedDataset?.id === dataset.id ? 'ring-2 ring-ros-primary' : ''
                    }`}
                    onClick={() => setSelectedDataset(dataset)}
                    data-testid={`card-dataset-${dataset.id}`}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass}`}>
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Badge variant="secondary" className="mb-1 text-xs">
                          {dataset.domain}
                        </Badge>
                        <h3 className="font-semibold text-sm leading-tight truncate" data-testid={`text-dataset-name-${dataset.id}`}>
                          {dataset.name}
                        </h3>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                      {dataset.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{safeLocaleString(dataset.records)}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{dataset.variables} vars</span>
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {selectedDataset && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              <Card className="p-6 border-ros-primary/20 bg-ros-primary/5" data-testid="card-dataset-details">
                {selectedDataset.phiStatus === 'IDENTIFIED' && (
                  <Alert variant="destructive" className="mb-4" data-testid="alert-phi-warning">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>PHI Warning:</strong> This dataset contains identified patient data. Special permissions and protocols are required for access and processing.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      {(() => {
                        const IconComponent = iconMap[selectedDataset.icon] || Database;
                        const colorClass = colorMap[selectedDataset.color] || colorMap["ros-primary"];
                        return (
                          <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${colorClass}`}>
                            <IconComponent className="h-7 w-7" />
                          </div>
                        );
                      })()}
                      <div>
                        <Badge variant="secondary" className="mb-1">{selectedDataset.domain}</Badge>
                        <h3 className="text-xl font-semibold">{selectedDataset.name}</h3>
                      </div>
                    </div>
                    <p className="text-muted-foreground mb-4">{selectedDataset.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="p-3 rounded-lg bg-background">
                        <div className="text-xs text-muted-foreground mb-1">Records</div>
                        <div className="text-lg font-semibold">{safeLocaleString(selectedDataset.records)}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-background">
                        <div className="text-xs text-muted-foreground mb-1">Variables</div>
                        <div className="text-lg font-semibold">{selectedDataset.variables}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-background">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Date Range
                        </div>
                        <div className="text-lg font-semibold">{selectedDataset.dateRange}</div>
                      </div>
                      <div className="p-3 rounded-lg bg-background">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Shield className="h-3 w-3" /> PHI Status
                        </div>
                        <div className="text-lg font-semibold text-ros-success">{selectedDataset.phiStatus}</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="lg:w-80">
                    <h4 className="font-medium mb-3">Sample Variables</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedDataset.sampleVariables.map((variable, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {variable}
                        </Badge>
                      ))}
                    </div>
                    <Button className="w-full mt-4" data-testid="button-use-dataset">
                      Use This Dataset
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
