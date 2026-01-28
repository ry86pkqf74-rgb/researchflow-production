/**
 * Vulnerable Populations Section Component
 *
 * Multi-select interface for identifying vulnerable populations
 * with dynamic requirements display based on selections.
 */

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  Baby,
  Users,
  Building2,
  Lock,
  Brain,
  Heart,
  GraduationCap,
  Briefcase,
  Shield,
  Info,
} from "lucide-react";

interface VulnerablePopulation {
  id: string;
  name: string;
  description: string;
  category: "age" | "capacity" | "relationship" | "other";
  requirements: string[];
  additional_protections: string[];
  irb_level_implications: string[];
}

interface VulnerablePopulationsResponse {
  populations: VulnerablePopulation[];
  categories: {
    id: string;
    name: string;
    description: string;
  }[];
}

interface VulnerablePopulationsSectionProps {
  selectedPopulations: string[];
  onSelectionChange: (populations: string[]) => void;
  institutionId: string;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  age: Baby,
  capacity: Brain,
  relationship: Building2,
  other: Users,
};

const POPULATION_ICONS: Record<string, React.ElementType> = {
  children: Baby,
  neonates: Baby,
  pregnant_women: Heart,
  prisoners: Lock,
  cognitively_impaired: Brain,
  students: GraduationCap,
  employees: Briefcase,
  wards_of_state: Shield,
};

export function VulnerablePopulationsSection({
  selectedPopulations,
  onSelectionChange,
  institutionId,
}: VulnerablePopulationsSectionProps) {
  const [expandedRequirements, setExpandedRequirements] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<VulnerablePopulationsResponse>({
    queryKey: ["/api/irb/vulnerable-populations", institutionId],
    queryFn: async () => {
      const res = await fetch(`/api/irb/vulnerable-populations?institution_id=${institutionId}`);
      if (!res.ok) throw new Error("Failed to fetch vulnerable populations");
      return res.json();
    },
    staleTime: 300000, // Cache for 5 minutes
  });

  const handleToggle = (populationId: string) => {
    if (selectedPopulations.includes(populationId)) {
      onSelectionChange(selectedPopulations.filter((p) => p !== populationId));
    } else {
      onSelectionChange([...selectedPopulations, populationId]);
    }
  };

  const selectedPopulationDetails = data?.populations.filter((p) =>
    selectedPopulations.includes(p.id)
  );

  // Aggregate requirements from all selected populations
  const aggregatedRequirements = new Set<string>();
  const aggregatedProtections = new Set<string>();
  const irbImplications = new Set<string>();

  selectedPopulationDetails?.forEach((pop) => {
    pop.requirements.forEach((r) => aggregatedRequirements.add(r));
    pop.additional_protections.forEach((p) => aggregatedProtections.add(p));
    pop.irb_level_implications.forEach((i) => irbImplications.add(i));
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load vulnerable populations. Please try again.</AlertDescription>
      </Alert>
    );
  }

  // Group populations by category
  const populationsByCategory = data?.categories.map((category) => ({
    ...category,
    populations: data.populations.filter((p) => p.category === category.id),
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Vulnerable Populations</CardTitle>
          </div>
          <CardDescription>
            Select all vulnerable populations that will be included in your study.
            This helps determine required protections and IRB review level.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {populationsByCategory?.map((category) => {
            const CategoryIcon = CATEGORY_ICONS[category.id] || Users;
            return (
              <div key={category.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium text-sm">{category.name}</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-6">
                  {category.populations.map((population) => {
                    const isSelected = selectedPopulations.includes(population.id);
                    const PopIcon = POPULATION_ICONS[population.id] || Users;
                    return (
                      <div
                        key={population.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/5 border-primary"
                            : "hover:bg-muted/50 hover:border-muted-foreground/30"
                        }`}
                        onClick={() => handleToggle(population.id)}
                      >
                        <Checkbox
                          id={population.id}
                          checked={isSelected}
                          onCheckedChange={() => handleToggle(population.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <PopIcon className="h-4 w-4 text-muted-foreground" />
                            <Label
                              htmlFor={population.id}
                              className="font-medium text-sm cursor-pointer"
                            >
                              {population.name}
                            </Label>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {population.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Requirements Summary */}
      {selectedPopulations.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base text-amber-700 dark:text-amber-400">
                Additional Requirements
              </CardTitle>
            </div>
            <CardDescription>
              Based on your selections, the following requirements apply:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected populations badges */}
            <div className="flex flex-wrap gap-2">
              {selectedPopulationDetails?.map((pop) => (
                <Badge key={pop.id} variant="secondary" className="gap-1">
                  {pop.name}
                </Badge>
              ))}
            </div>

            {/* IRB Level Implications */}
            {irbImplications.size > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  IRB Review Implications
                </h5>
                <ul className="text-sm space-y-1 ml-6">
                  {Array.from(irbImplications).map((impl, i) => (
                    <li key={i} className="text-muted-foreground">
                      • {impl}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Required Protections */}
            {aggregatedProtections.size > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Required Protections
                </h5>
                <ul className="text-sm space-y-1 ml-6">
                  {Array.from(aggregatedProtections).map((prot, i) => (
                    <li key={i} className="text-muted-foreground">
                      • {prot}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Documentation Requirements */}
            {aggregatedRequirements.size > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Documentation Requirements
                </h5>
                <ul className="text-sm space-y-1 ml-6">
                  {Array.from(aggregatedRequirements).map((req, i) => (
                    <li key={i} className="text-muted-foreground">
                      • {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No selection info */}
      {selectedPopulations.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>No Vulnerable Populations Selected</AlertTitle>
          <AlertDescription>
            If your study includes only healthy adults without any special characteristics,
            you may not need to select any options above. However, carefully consider whether
            any participants might fall into these categories.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default VulnerablePopulationsSection;
