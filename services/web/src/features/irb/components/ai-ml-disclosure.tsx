/**
 * AI/ML Disclosure Component
 *
 * Comprehensive disclosure form for AI/ML usage in research studies.
 * Follows Emory IRB requirements for transparent AI documentation.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sparkles,
  Bot,
  Database,
  Shield,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Brain,
  FileText,
  Lock,
  Eye,
} from "lucide-react";

interface AIMLUsage {
  uses_ai_ml: boolean;
  ai_ml_purposes: string[];
  model_types: string[];
  training_data_description: string;
  bias_mitigation: string;
  human_oversight: string;
  transparency_measures: string;
  data_retention: string;
  model_names?: string[];
  vendor_names?: string[];
  consent_language_included: boolean;
}

interface AIMLDisclosureProps {
  value: AIMLUsage;
  onChange: (value: AIMLUsage) => void;
  institutionId: string;
}

interface ComplianceResult {
  compliant: boolean;
  score: number;
  missing_disclosures: string[];
  recommendations: string[];
  required_consent_language: string[];
}

const AI_PURPOSES = [
  { id: "data_analysis", label: "Data Analysis", description: "Using AI to analyze research data" },
  { id: "pattern_recognition", label: "Pattern Recognition", description: "Identifying patterns in datasets" },
  { id: "prediction", label: "Predictive Modeling", description: "Making predictions based on data" },
  { id: "nlp", label: "Natural Language Processing", description: "Processing text or speech data" },
  { id: "image_analysis", label: "Image/Video Analysis", description: "Analyzing visual data" },
  { id: "decision_support", label: "Decision Support", description: "Assisting clinical or research decisions" },
  { id: "data_extraction", label: "Data Extraction", description: "Extracting information from documents" },
  { id: "generation", label: "Content Generation", description: "Generating text, images, or other content" },
];

const MODEL_TYPES = [
  { id: "llm", label: "Large Language Model (LLM)", icon: Brain },
  { id: "ml_classifier", label: "ML Classifier", icon: Database },
  { id: "neural_network", label: "Neural Network", icon: Bot },
  { id: "computer_vision", label: "Computer Vision Model", icon: Eye },
  { id: "custom", label: "Custom/Proprietary Model", icon: Shield },
];

export function AIMLDisclosure({ value, onChange, institutionId }: AIMLDisclosureProps) {
  const [showGuidance, setShowGuidance] = useState(true);

  const complianceMutation = useMutation({
    mutationFn: async (disclosure: AIMLUsage) => {
      const res = await fetch("/api/irb/ai-ml/compliance-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disclosure,
          institution_id: institutionId,
        }),
      });
      if (!res.ok) throw new Error("Compliance check failed");
      return res.json() as Promise<ComplianceResult>;
    },
  });

  const handleUsesAIMLChange = (uses: boolean) => {
    onChange({
      ...value,
      uses_ai_ml: uses,
      // Reset other fields if not using AI/ML
      ...(uses ? {} : {
        ai_ml_purposes: [],
        model_types: [],
        training_data_description: "",
        bias_mitigation: "",
        human_oversight: "",
        transparency_measures: "",
        data_retention: "",
        model_names: [],
        vendor_names: [],
        consent_language_included: false,
      }),
    });
  };

  const handlePurposeToggle = (purposeId: string) => {
    const current = value.ai_ml_purposes || [];
    if (current.includes(purposeId)) {
      onChange({ ...value, ai_ml_purposes: current.filter((p) => p !== purposeId) });
    } else {
      onChange({ ...value, ai_ml_purposes: [...current, purposeId] });
    }
  };

  const handleModelTypeToggle = (typeId: string) => {
    const current = value.model_types || [];
    if (current.includes(typeId)) {
      onChange({ ...value, model_types: current.filter((t) => t !== typeId) });
    } else {
      onChange({ ...value, model_types: [...current, typeId] });
    }
  };

  const runComplianceCheck = () => {
    complianceMutation.mutate(value);
  };

  return (
    <div className="space-y-4">
      {/* Main Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">AI/ML Usage Disclosure</CardTitle>
          </div>
          <CardDescription>
            Disclose any use of artificial intelligence or machine learning in your research.
            This includes AI-assisted analysis, automated decision-making, and generative AI tools.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={value.uses_ai_ml ? "yes" : "no"}
            onValueChange={(v) => handleUsesAIMLChange(v === "yes")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="ai-yes" />
              <Label htmlFor="ai-yes">Yes, this study uses AI/ML technology</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="ai-no" />
              <Label htmlFor="ai-no">No AI/ML technology is used</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Detailed disclosure - only shown if AI/ML is used */}
      {value.uses_ai_ml && (
        <>
          {/* Guidance Panel */}
          <Collapsible open={showGuidance} onOpenChange={setShowGuidance}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {institutionId === "emory" ? "Emory IRB AI/ML Guidelines" : "AI/ML Disclosure Guidelines"}
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showGuidance ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Alert className="mt-2">
                <Sparkles className="h-4 w-4" />
                <AlertTitle>AI/ML Disclosure Requirements</AlertTitle>
                <AlertDescription className="text-sm space-y-2 mt-2">
                  <p>When using AI/ML in research, you must disclose:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Specific AI/ML tools and their purposes</li>
                    <li>How AI decisions are validated by humans</li>
                    <li>Measures to address bias and fairness</li>
                    <li>Data privacy and security protections</li>
                    <li>Transparency with research participants</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CollapsibleContent>
          </Collapsible>

          {/* AI/ML Purposes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bot className="h-4 w-4" />
                AI/ML Usage Purposes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AI_PURPOSES.map((purpose) => (
                  <div
                    key={purpose.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      value.ai_ml_purposes?.includes(purpose.id)
                        ? "bg-primary/5 border-primary"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => handlePurposeToggle(purpose.id)}
                  >
                    <Checkbox
                      checked={value.ai_ml_purposes?.includes(purpose.id)}
                      onCheckedChange={() => handlePurposeToggle(purpose.id)}
                    />
                    <div>
                      <Label className="font-medium cursor-pointer">{purpose.label}</Label>
                      <p className="text-xs text-muted-foreground">{purpose.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Model Types */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Model Types Used
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {MODEL_TYPES.map((type) => {
                  const isSelected = value.model_types?.includes(type.id);
                  const Icon = type.icon;
                  return (
                    <Badge
                      key={type.id}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer gap-1.5 py-1.5 px-3"
                      onClick={() => handleModelTypeToggle(type.id)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {type.label}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Model/Vendor Names */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Specific Models or Vendors</CardTitle>
              <CardDescription className="text-xs">
                List specific AI models (e.g., GPT-4, BERT) or vendors (e.g., OpenAI, Google Cloud AI)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="model-names" className="text-sm">Model Names</Label>
                <Input
                  id="model-names"
                  placeholder="e.g., GPT-4, Claude, BERT, Custom CNN"
                  value={value.model_names?.join(", ") || ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      model_names: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="vendor-names" className="text-sm">Vendor Names</Label>
                <Input
                  id="vendor-names"
                  placeholder="e.g., OpenAI, Anthropic, Google Cloud"
                  value={value.vendor_names?.join(", ") || ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      vendor_names: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Detailed Disclosures */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Required Disclosures
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="training-data" className="text-sm font-medium">
                  Training Data Description
                </Label>
                <Textarea
                  id="training-data"
                  placeholder="Describe what data the AI/ML models were trained on, or if using pre-trained models, describe their training data sources..."
                  value={value.training_data_description || ""}
                  onChange={(e) => onChange({ ...value, training_data_description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bias-mitigation" className="text-sm font-medium">
                  Bias Mitigation Measures
                </Label>
                <Textarea
                  id="bias-mitigation"
                  placeholder="Describe steps taken to identify and mitigate potential biases in AI/ML outputs..."
                  value={value.bias_mitigation || ""}
                  onChange={(e) => onChange({ ...value, bias_mitigation: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="human-oversight" className="text-sm font-medium">
                  Human Oversight Procedures
                </Label>
                <Textarea
                  id="human-oversight"
                  placeholder="Describe how human researchers will review and validate AI/ML outputs..."
                  value={value.human_oversight || ""}
                  onChange={(e) => onChange({ ...value, human_oversight: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transparency" className="text-sm font-medium">
                  Transparency Measures
                </Label>
                <Textarea
                  id="transparency"
                  placeholder="Describe how participants will be informed about AI/ML usage in the research..."
                  value={value.transparency_measures || ""}
                  onChange={(e) => onChange({ ...value, transparency_measures: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data-retention" className="text-sm font-medium">
                  AI Data Retention Policy
                </Label>
                <Textarea
                  id="data-retention"
                  placeholder="Describe data retention policies for AI/ML model inputs and outputs..."
                  value={value.data_retention || ""}
                  onChange={(e) => onChange({ ...value, data_retention: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Consent Language */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Consent Documentation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent-language"
                  checked={value.consent_language_included}
                  onCheckedChange={(checked) =>
                    onChange({ ...value, consent_language_included: !!checked })
                  }
                />
                <div>
                  <Label htmlFor="consent-language" className="cursor-pointer">
                    AI/ML usage is disclosed in consent forms
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Confirm that your consent documents include language informing participants
                    about the use of AI/ML technology in this research.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Compliance Check */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Compliance Check</CardTitle>
                <Button
                  size="sm"
                  onClick={runComplianceCheck}
                  disabled={complianceMutation.isPending}
                >
                  {complianceMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Check Compliance"
                  )}
                </Button>
              </div>
            </CardHeader>
            {complianceMutation.data && (
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {complianceMutation.data.compliant ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    )}
                    <span
                      className={
                        complianceMutation.data.compliant
                          ? "text-green-600 font-medium"
                          : "text-amber-600 font-medium"
                      }
                    >
                      {complianceMutation.data.compliant
                        ? "Disclosure is compliant"
                        : "Additional information needed"}
                    </span>
                    <Badge variant="outline">Score: {complianceMutation.data.score}%</Badge>
                  </div>

                  {complianceMutation.data.missing_disclosures.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-amber-600">Missing Disclosures:</p>
                      <ul className="text-sm space-y-1">
                        {complianceMutation.data.missing_disclosures.map((item, i) => (
                          <li key={i} className="text-muted-foreground flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 mt-0.5 text-amber-500" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {complianceMutation.data.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Recommendations:</p>
                      <ul className="text-sm space-y-1">
                        {complianceMutation.data.recommendations.map((rec, i) => (
                          <li key={i} className="text-muted-foreground">
                            • {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export default AIMLDisclosure;
