import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ScanEye, History, CheckCheck, Lock, FileCheck, Clock } from "lucide-react";
import { motion } from "framer-motion";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  ShieldCheck, ScanEye, History, CheckCheck
};

const complianceFeatures = [
  {
    id: "hipaa",
    title: "HIPAA Compliance",
    description: "Full compliance with Health Insurance Portability and Accountability Act requirements for protected health information",
    icon: "ShieldCheck",
    status: "certified" as const
  },
  {
    id: "phi-scan",
    title: "Automated PHI Detection",
    description: "AI-powered scanning for 18 HIPAA identifiers including names, dates, locations, and medical record numbers",
    icon: "ScanEye",
    status: "active" as const
  },
  {
    id: "audit",
    title: "Complete Audit Trail",
    description: "Full traceability of all data access, transformations, and analysis steps with timestamped logging",
    icon: "History",
    status: "active" as const
  },
  {
    id: "validation",
    title: "Data Validation Checkpoints",
    description: "Multi-stage validation ensuring data integrity, quality scores, and anomaly detection at each pipeline stage",
    icon: "CheckCheck",
    status: "validated" as const
  }
];

const auditTrail = [
  { time: "09:42:15", action: "Dataset uploaded", user: "Dr. Smith", status: "success" },
  { time: "09:42:18", action: "PHI scan initiated", user: "System", status: "success" },
  { time: "09:42:45", action: "18 HIPAA identifiers checked", user: "System", status: "success" },
  { time: "09:42:47", action: "3 potential PHI items flagged", user: "System", status: "warning" },
  { time: "09:43:12", action: "PHI de-identification applied", user: "Dr. Smith", status: "success" },
  { time: "09:43:15", action: "Compliance certificate generated", user: "System", status: "success" },
];

export function GovernanceSection() {
  return (
    <section className="py-16 lg:py-24 bg-muted/30" data-testid="section-governance">
      <div className="container mx-auto px-6 lg:px-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 lg:mb-16"
        >
          <Badge variant="secondary" className="mb-4 px-4 py-1.5 bg-ros-success/10 text-ros-success border-ros-success/20" data-testid="badge-governance-section">
            Governance-First Approach
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-governance-heading">
            Built for Compliance
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-governance-description">
            Security and compliance are not afterthoughts. Every feature is designed with 
            HIPAA requirements, data validation, and audit trails at its core.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
            data-testid="list-compliance-features"
          >
            {complianceFeatures.map((feature) => {
              const IconComponent = iconMap[feature.icon] || ShieldCheck;
              return (
                <Card key={feature.id} className="p-6 border-border/50 hover-elevate" data-testid={`card-compliance-${feature.id}`}>
                  <div className="flex gap-4">
                    <div className={`
                      w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0
                      ${feature.status === 'certified' ? 'bg-ros-success/10 text-ros-success' : ''}
                      ${feature.status === 'active' ? 'bg-ros-primary/10 text-ros-primary' : ''}
                      ${feature.status === 'validated' ? 'bg-ros-workflow/10 text-ros-workflow' : ''}
                    `}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold" data-testid={`text-compliance-title-${feature.id}`}>{feature.title}</h3>
                        <Badge 
                          className={`
                            text-xs
                            ${feature.status === 'certified' ? 'bg-ros-success/10 text-ros-success border-ros-success/20' : ''}
                            ${feature.status === 'active' ? 'bg-ros-primary/10 text-ros-primary border-ros-primary/20' : ''}
                            ${feature.status === 'validated' ? 'bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20' : ''}
                          `}
                          data-testid={`badge-compliance-status-${feature.id}`}
                        >
                          {feature.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground" data-testid={`text-compliance-desc-${feature.id}`}>{feature.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-6 border-border/50 h-full" data-testid="card-audit-trail">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-ros-primary" />
                  <h3 className="font-semibold" data-testid="text-audit-title">Live Audit Trail</h3>
                </div>
                <Badge variant="secondary" className="text-xs" data-testid="badge-audit-realtime">
                  Real-time
                </Badge>
              </div>

              <div className="space-y-3" data-testid="list-audit-entries">
                {auditTrail.map((entry, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                    data-testid={`audit-entry-${index}`}
                  >
                    <div className={`
                      w-2 h-2 rounded-full mt-1.5 flex-shrink-0
                      ${entry.status === 'success' ? 'bg-ros-success' : 'bg-amber-500'}
                    `} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" data-testid={`text-audit-action-${index}`}>{entry.action}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span data-testid={`text-audit-time-${index}`}>{entry.time}</span>
                        <span className="text-muted-foreground/50">|</span>
                        <span data-testid={`text-audit-user-${index}`}>{entry.user}</span>
                      </div>
                    </div>
                    {entry.status === 'warning' && (
                      <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-xs" data-testid={`badge-audit-warning-${index}`}>
                        Review
                      </Badge>
                    )}
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-ros-success" />
                    <span className="text-sm text-muted-foreground" data-testid="text-audit-encrypted">All actions encrypted & logged</span>
                  </div>
                  <FileCheck className="h-5 w-5 text-ros-success" />
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="p-8 border-ros-success/20 bg-ros-success/5" data-testid="card-certifications">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-ros-success/10 flex items-center justify-center">
                  <ShieldCheck className="h-8 w-8 text-ros-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg" data-testid="text-cert-title">HIPAA Certified Platform</h3>
                  <p className="text-muted-foreground" data-testid="text-cert-description">
                    Fully compliant with all 18 HIPAA identifiers and healthcare data regulations
                  </p>
                </div>
              </div>
              <div className="flex gap-3" data-testid="list-cert-badges">
                <Badge className="px-4 py-2 bg-ros-success text-white" data-testid="badge-soc2">
                  SOC 2 Type II
                </Badge>
                <Badge className="px-4 py-2 bg-ros-primary text-white" data-testid="badge-hipaa">
                  HIPAA
                </Badge>
                <Badge className="px-4 py-2 bg-ros-workflow text-white" data-testid="badge-gdpr">
                  GDPR
                </Badge>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
