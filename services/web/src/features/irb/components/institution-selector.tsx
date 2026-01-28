/**
 * Institution Selector Component
 *
 * Allows users to select their institution's IRB template.
 * Fetches available institutions from the enhanced IRB API.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, CheckCircle2, FileText, Shield, Sparkles } from "lucide-react";

interface InstitutionInfo {
  id: string;
  name: string;
  display_name: string;
  description: string;
  supports_exemption: boolean;
  requires_lay_summary: boolean;
  requires_ai_ml_disclosure: boolean;
}

interface InstitutionSelectorProps {
  selectedInstitution: string | null;
  onSelect: (institutionId: string) => void;
}

export function InstitutionSelector({ selectedInstitution, onSelect }: InstitutionSelectorProps) {
  const { data: institutions, isLoading, error } = useQuery<InstitutionInfo[]>({
    queryKey: ["/api/irb/institutions"],
    queryFn: async () => {
      const res = await fetch("/api/irb/institutions");
      if (!res.ok) throw new Error("Failed to fetch institutions");
      return res.json();
    },
    staleTime: 60000, // Cache for 1 minute
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-full mb-4" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-4">
          <p className="text-destructive text-sm">
            Failed to load institutions. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-medium">Select Your Institution</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {institutions?.map((institution) => (
          <Card
            key={institution.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedInstitution === institution.id
                ? "border-primary ring-2 ring-primary/20"
                : "hover:border-primary/50"
            }`}
            onClick={() => onSelect(institution.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{institution.display_name}</CardTitle>
                  {selectedInstitution === institution.id && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </div>
              </div>
              <CardDescription className="text-xs">
                {institution.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {institution.supports_exemption && (
                  <Badge variant="outline" className="text-xs">
                    <Shield className="h-3 w-3 mr-1" />
                    Exemption
                  </Badge>
                )}
                {institution.requires_lay_summary && (
                  <Badge variant="outline" className="text-xs">
                    <FileText className="h-3 w-3 mr-1" />
                    Lay Summary
                  </Badge>
                )}
                {institution.requires_ai_ml_disclosure && (
                  <Badge variant="outline" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI/ML Disclosure
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedInstitution && (
        <div className="flex justify-end">
          <Button onClick={() => onSelect(selectedInstitution)}>
            Continue with {institutions?.find(i => i.id === selectedInstitution)?.display_name}
          </Button>
        </div>
      )}
    </div>
  );
}

export default InstitutionSelector;
