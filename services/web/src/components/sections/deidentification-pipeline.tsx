import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Zap,
  Shield,
  Lock,
  CheckCircle2,
  Key,
  Users,
  Calendar,
  FileText,
  MapPin,
  AlertCircle,
  CheckCheck,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";

interface DetectedPHI {
  type: string;
  count: number;
  instances: string[];
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface TransformationRule {
  field: string;
  original: string;
  transformed: string;
}

const detectedPHI: DetectedPHI[] = [
  {
    type: "Patient Names",
    count: 18,
    instances: [
      "John Smith",
      "Mary Johnson",
      "Robert Brown",
      "Michael Davis",
      "Jennifer Wilson",
      "Dr. Patricia Anderson",
    ],
    color: "text-ros-alert",
    bgColor: "bg-ros-alert/10",
    icon: FileText,
  },
  {
    type: "Dates",
    count: 47,
    instances: [
      "01/15/1985",
      "03/22/1992",
      "07/08/1978",
      "12/30/2001",
      "05/11/1988",
      "09/19/1995",
    ],
    color: "text-ros-workflow",
    bgColor: "bg-ros-workflow/10",
    icon: Calendar,
  },
  {
    type: "MRNs",
    count: 23,
    instances: [
      "MRN#847291",
      "MRN#934567",
      "MRN#102847",
      "MRN#564729",
      "MRN#291847",
      "MRN#847562",
    ],
    color: "text-ros-primary",
    bgColor: "bg-ros-primary/10",
    icon: Shield,
  },
  {
    type: "Addresses",
    count: 12,
    instances: [
      "123 Oak Street, Atlanta, GA 30303",
      "456 Elm Avenue, Boston, MA 02101",
      "789 Pine Road, Chicago, IL 60601",
      "321 Maple Drive, Houston, TX 77001",
    ],
    color: "text-ros-workflow",
    bgColor: "bg-ros-workflow/10",
    icon: MapPin,
  },
];

const transformationRules: TransformationRule[] = [
  {
    field: "Birth Date",
    original: "01/15/1985",
    transformed: "1985",
  },
  {
    field: "Age >89",
    original: "92 years",
    transformed: "90 years",
  },
  {
    field: "ZIP Code",
    original: "30303-4567",
    transformed: "303",
  },
  {
    field: "Hospital Unit",
    original: "ICU-Unit-B-Bed-12",
    transformed: "ICU",
  },
];

const linkageKeyVault = {
  keyId: "LK-2024-0847",
  createdDate: "2024-01-16",
  expiryDate: "2025-01-16",
  accessRoles: ["Principal Investigator", "Data Manager", "IRB Reviewer"],
  encryptionStatus: "AES-256",
  dataEncrypted: 15847,
  accessLog: [
    { timestamp: "09:42:15", action: "Key created", user: "Dr. Chen" },
    { timestamp: "09:43:22", action: "PI access granted", user: "System" },
    { timestamp: "09:44:10", action: "Data Manager access granted", user: "System" },
  ],
};

export function DeidentificationPipeline() {
  const stages = [
    {
      name: "PHI Detection",
      description: "Scan for 18 HIPAA identifiers",
      icon: Zap,
      status: "completed" as const,
      color: "ros-alert",
    },
    {
      name: "De-identification",
      description: "Apply Safe Harbor method",
      icon: Shield,
      status: "completed" as const,
      color: "ros-primary",
    },
    {
      name: "Linkage Key Vault",
      description: "Secure storage with controls",
      icon: Lock,
      status: "active" as const,
      color: "ros-workflow",
    },
    {
      name: "Validation",
      description: "Verify no residual PHI",
      icon: CheckCircle2,
      status: "pending" as const,
      color: "ros-success",
    },
  ];

  const totalPHIDetected = detectedPHI.reduce((sum, phi) => sum + phi.count, 0);
  const deidentifiedPercentage = 98;

  return (
    <section className="py-16 lg:py-24 bg-muted/30" data-testid="section-deidentification">
      <div className="container mx-auto px-6 lg:px-24">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 lg:mb-16"
        >
          <Badge
            variant="secondary"
            className="mb-4 px-4 py-1.5 bg-ros-primary/10 text-ros-primary border-ros-primary/20"
            data-testid="badge-deidentification-section"
          >
            Data Privacy & Compliance
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground mb-4" data-testid="text-deidentification-heading">
            De-identification Pipeline
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-deidentification-description">
            Automated PHI removal with secure linkage key management. Maintain
            data utility while ensuring HIPAA compliance through Safe Harbor
            de-identification standards.
          </p>
        </motion.div>

        {/* Visual Pipeline Stages */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-12"
        >
          <div className="flex flex-col lg:flex-row gap-4 items-stretch" data-testid="pipeline-stages">
            {stages.map((stage, index) => {
              const IconComponent = stage.icon;
              const isCompleted = stage.status === "completed";
              const isActive = stage.status === "active";

              return (
                <div key={stage.name} className="flex-1 flex flex-col">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className="flex-1"
                  >
                    <Card
                      className={`p-6 h-full flex flex-col gap-4 border ${
                        isCompleted
                          ? "border-ros-success/30 bg-ros-success/5"
                          : isActive
                            ? "border-ros-workflow/50 bg-ros-workflow/5"
                            : "border-border/50 bg-muted/30"
                      }`}
                      data-testid={`stage-${stage.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            isCompleted
                              ? "bg-ros-success/10 text-ros-success"
                              : isActive
                                ? "bg-ros-workflow/10 text-ros-workflow"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <IconComponent className="h-6 w-6" />
                        </div>
                        {isCompleted && (
                          <CheckCheck className="h-5 w-5 text-ros-success" />
                        )}
                      </div>

                      <div>
                        <h3 className="font-semibold text-foreground mb-1">
                          Stage {index + 1}
                        </h3>
                        <h4 className="text-lg font-semibold text-foreground mb-2">
                          {stage.name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {stage.description}
                        </p>
                      </div>

                      <Badge
                        className={`w-fit text-xs ${
                          isCompleted
                            ? "bg-ros-success/10 text-ros-success border-ros-success/20"
                            : isActive
                              ? "bg-ros-workflow/10 text-ros-workflow border-ros-workflow/20"
                              : "bg-muted text-muted-foreground border-muted"
                        }`}
                      >
                        {isCompleted ? "Complete" : isActive ? "Active" : "Pending"}
                      </Badge>
                    </Card>
                  </motion.div>

                  {index < stages.length - 1 && (
                    <motion.div
                      initial={{ scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: (index + 0.5) * 0.1 }}
                      className="hidden lg:flex items-center justify-center h-8"
                    >
                      <ArrowRight className="h-5 w-5 text-muted-foreground/40 rotate-90" />
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* PHI Detection and De-identification Stats */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Detected PHI */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-6 border-border/50" data-testid="card-phi-detection">
              <div className="flex items-center gap-2 mb-6">
                <AlertCircle className="h-5 w-5 text-ros-alert" />
                <h3 className="font-semibold text-lg">Detected PHI Elements</h3>
              </div>

              <div className="mb-6 p-4 rounded-lg bg-ros-alert/5 border border-ros-alert/20">
                <div className="text-3xl font-bold text-ros-alert mb-1">
                  {totalPHIDetected}
                </div>
                <p className="text-sm text-muted-foreground">
                  Total identifiers found across dataset
                </p>
              </div>

              <div className="space-y-4">
                {detectedPHI.map((phi) => {
                  const IconComponent = phi.icon;
                  return (
                    <motion.div
                      key={phi.type}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3 }}
                      className={`p-4 rounded-lg ${phi.bgColor}`}
                      data-testid={`phi-type-${phi.type.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <IconComponent className={`h-5 w-5 mt-0.5 ${phi.color}`} />
                          <div className="flex-1">
                            <div className="font-semibold text-foreground">
                              {phi.type}
                            </div>
                            <div className={`text-sm ${phi.color} font-medium mb-2`}>
                              {phi.count} instances found
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {phi.instances.slice(0, 3).map((instance, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {instance}
                                </Badge>
                              ))}
                              {phi.instances.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{phi.instances.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </Card>
          </motion.div>

          {/* De-identification Progress */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-6 border-border/50 h-full flex flex-col" data-testid="card-deidentification-progress">
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle2 className="h-5 w-5 text-ros-success" />
                <h3 className="font-semibold text-lg">De-identification Status</h3>
              </div>

              <div className="mb-8 p-4 rounded-lg bg-ros-success/5 border border-ros-success/20 flex-1">
                <div className="text-3xl font-bold text-ros-success mb-2">
                  {deidentifiedPercentage}%
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Data successfully de-identified using Safe Harbor method
                </p>
                <Progress value={deidentifiedPercentage} className="h-2" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium">Method Applied</span>
                  <Badge className="bg-ros-primary/10 text-ros-primary border-ros-primary/20">
                    Safe Harbor
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium">Data Utility Retained</span>
                  <Badge className="bg-ros-success/10 text-ros-success border-ros-success/20">
                    94%
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium">Risk Level</span>
                  <Badge className="bg-ros-success/10 text-ros-success border-ros-success/20">
                    Very Low
                  </Badge>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Transformation Rules */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-12"
        >
          <Card className="p-6 border-border/50" data-testid="card-transformation-rules">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="h-5 w-5 text-ros-primary" />
              <h3 className="font-semibold text-lg">Transformation Rules</h3>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {transformationRules.map((rule, index) => (
                <motion.div
                  key={rule.field}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="p-4 rounded-lg bg-muted/50 border border-border"
                  data-testid={`rule-${rule.field.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <div className="text-sm font-semibold text-foreground mb-3">
                    {rule.field}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Original
                      </div>
                      <code className="text-sm bg-ros-alert/10 text-ros-alert px-2 py-1 rounded block">
                        {rule.original}
                      </code>
                    </div>
                    <div className="flex items-center justify-center py-1">
                      <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">
                        Transformed
                      </div>
                      <code className="text-sm bg-ros-success/10 text-ros-success px-2 py-1 rounded block">
                        {rule.transformed}
                      </code>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Linkage Key Vault Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="p-8 border-ros-success/30 bg-gradient-to-br from-ros-success/5 to-transparent" data-testid="panel-linkage-vault">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Key Information */}
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <Key className="h-6 w-6 text-ros-success" />
                  <h3 className="font-semibold text-xl">Linkage Key Vault</h3>
                </div>

                <div className="space-y-4">
                  {/* Key ID */}
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Key Identifier
                    </div>
                    <div className="text-lg font-mono font-bold text-foreground">
                      {linkageKeyVault.keyId}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Created
                      </div>
                      <div className="font-semibold text-foreground">
                        {linkageKeyVault.createdDate}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Expires
                      </div>
                      <div className="font-semibold text-foreground">
                        {linkageKeyVault.expiryDate}
                      </div>
                    </div>
                  </div>

                  {/* Encryption Status */}
                  <div className="p-4 rounded-lg bg-ros-success/10 border border-ros-success/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Encryption
                      </div>
                      <Badge className="bg-ros-success/20 text-ros-success border-ros-success/30">
                        Active
                      </Badge>
                    </div>
                    <div className="font-mono text-sm font-semibold text-ros-success">
                      {linkageKeyVault.encryptionStatus}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {linkageKeyVault.dataEncrypted.toLocaleString()} records encrypted
                    </div>
                  </div>

                  {/* Request Re-identification Button */}
                  <Button
                    disabled
                    className="w-full gap-2"
                    data-testid="button-request-reident"
                  >
                    <Key className="h-4 w-4" />
                    Request Re-identification
                  </Button>
                </div>
              </div>

              {/* Access Control and Log */}
              <div className="flex flex-col gap-6">
                {/* Access Permissions */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-5 w-5 text-ros-primary" />
                    <h4 className="font-semibold">Access Permissions</h4>
                  </div>
                  <div className="space-y-2">
                    {linkageKeyVault.accessRoles.map((role, idx) => (
                      <motion.div
                        key={role}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: idx * 0.1 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border"
                        data-testid={`access-role-${idx}`}
                      >
                        <CheckCheck className="h-4 w-4 text-ros-success" />
                        <span className="font-medium text-foreground">{role}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Access Log */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="h-5 w-5 text-ros-alert" />
                    <h4 className="font-semibold">Recent Access Log</h4>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {linkageKeyVault.accessLog.map((log, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 5 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.2, delay: idx * 0.05 }}
                        className="p-3 rounded-lg bg-muted/30 text-sm"
                        data-testid={`access-log-${idx}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            {log.timestamp}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {log.action}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.user}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Security Info */}
            <div className="mt-8 pt-8 border-t border-border">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-ros-success" />
                  <span className="text-sm text-muted-foreground">
                    All keys are encrypted at rest and in transit
                  </span>
                </div>
                <Badge className="bg-ros-success/10 text-ros-success border-ros-success/20">
                  Secure Storage Verified
                </Badge>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
