/**
 * AI Consent Authorization Modal
 * 
 * Modal for obtaining explicit user consent before making AI recommendations.
 * Auto-fills user name from authentication and requires explicit authorization.
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Bot, 
  ShieldAlert, 
  AlertTriangle,
  CheckCircle2,
  Info
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export interface AIConsentResult {
  authorized: boolean;
  authorizedBy: string;
  timestamp: string;
  scope: string; // e.g., "topic-declaration-recommendations"
}

interface AIConsentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthorize: (result: AIConsentResult) => void;
  scope: string;
  scopeDescription: string;
}

export function AIConsentModal({
  isOpen,
  onOpenChange,
  onAuthorize,
  scope,
  scopeDescription
}: AIConsentModalProps) {
  const { user } = useAuth();
  const [authorizedBy, setAuthorizedBy] = useState("");
  const [understandLimitations, setUnderstandLimitations] = useState(false);
  const [acceptResponsibility, setAcceptResponsibility] = useState(false);

  // Auto-fill user's name when modal opens
  useEffect(() => {
    if (isOpen && user) {
      const name = user.displayName || 
                   (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : '') ||
                   user.email.split('@')[0];
      setAuthorizedBy(name);
    }
  }, [isOpen, user]);

  const handleAuthorize = () => {
    if (!authorizedBy.trim() || !understandLimitations || !acceptResponsibility) {
      return;
    }

    const result: AIConsentResult = {
      authorized: true,
      authorizedBy: authorizedBy.trim(),
      timestamp: new Date().toISOString(),
      scope
    };

    onAuthorize(result);
    onOpenChange(false);

    // Reset for next time
    setUnderstandLimitations(false);
    setAcceptResponsibility(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset checkboxes
    setUnderstandLimitations(false);
    setAcceptResponsibility(false);
  };

  const canAuthorize = authorizedBy.trim() && understandLimitations && acceptResponsibility;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Bot className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-xl">AI Assistance Authorization Required</DialogTitle>
          </div>
          <DialogDescription className="text-base mt-2">
            {scopeDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Authorization Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Before proceeding, you must review and authorize the use of AI assistance for this task.
              Your authorization will be recorded in the audit log.
            </AlertDescription>
          </Alert>

          {/* User Name Field */}
          <div className="space-y-2">
            <Label htmlFor="authorizer-name" className="text-sm font-medium">
              Your Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="authorizer-name"
              value={authorizedBy}
              onChange={(e) => setAuthorizedBy(e.target.value)}
              placeholder="Enter your full name"
              className="font-medium"
            />
            <p className="text-xs text-muted-foreground">
              This will be recorded in the audit log as the authorizing researcher.
            </p>
          </div>

          {/* Terms and Conditions */}
          <Card className="p-4 space-y-4 bg-muted/30">
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                AI Assistance Terms
              </h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p>AI will provide <strong>recommendations only</strong> - you maintain full control over your research design</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p>Suggestions are based on research best practices but may not be appropriate for your specific context</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p>Your research overview will be processed by OpenAI's API to generate recommendations</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t">
              <h4 className="font-semibold flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" />
                Important Limitations
              </h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p>AI suggestions may contain errors, biases, or inappropriate recommendations</p>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p>You are responsible for validating all AI suggestions against your domain expertise</p>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p>AI recommendations do not constitute methodological, statistical, or ethical guidance</p>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p>All final research decisions remain your sole responsibility</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Consent Checkboxes */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id="understand-limitations"
                checked={understandLimitations}
                onCheckedChange={(checked) => setUnderstandLimitations(checked === true)}
              />
              <Label
                htmlFor="understand-limitations"
                className="text-sm font-normal cursor-pointer leading-tight"
              >
                I understand that AI suggestions are recommendations only and may contain errors or biases.
                I will critically evaluate all suggestions before implementation. <span className="text-red-500">*</span>
              </Label>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="accept-responsibility"
                checked={acceptResponsibility}
                onCheckedChange={(checked) => setAcceptResponsibility(checked === true)}
              />
              <Label
                htmlFor="accept-responsibility"
                className="text-sm font-normal cursor-pointer leading-tight"
              >
                I accept full responsibility for all research design decisions and will validate
                AI suggestions against my domain expertise and institutional requirements. <span className="text-red-500">*</span>
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAuthorize}
            disabled={!canAuthorize}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <Bot className="h-4 w-4 mr-2" />
            Authorize AI Assistance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
