/**
 * React Hook for REAL Statistical Analysis
 *
 * This hook provides access to the new AnalysisService endpoints that perform
 * actual statistical computations using scipy, statsmodels, and lifelines.
 *
 * Unlike the mock SAP endpoints, these return real statistical results
 * computed on actual uploaded datasets.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Types for analysis requests and responses
export interface RealAnalysisInput {
  analysis_type: "descriptive" | "inferential" | "survival" | "regression" | "correlation";
  dataset_path?: string;
  dataset_id?: string;
  variables?: string[];
  group_variable?: string;
  outcome_variable?: string;
  time_variable?: string;
  event_variable?: string;
  covariates?: string[];
  test_type?: string;
  regression_type?: "linear" | "logistic" | "poisson" | "cox";
  correction_method?: "none" | "bonferroni" | "holm" | "fdr_bh";
  alpha_level?: number;
  confidence_level?: number;
}

export interface DescriptiveResult {
  variable: string;
  n: number;
  n_missing: number;
  mean?: number;
  std?: number;
  median?: number;
  min?: number;
  max?: number;
  q1?: number;
  q3?: number;
  skewness?: number;
  kurtosis?: number;
  normality_p?: number;
}

export interface InferentialResult {
  test_name: string;
  variable: string;
  statistic: number;
  statistic_name: string;
  p_value: number;
  adjusted_p_value?: number;
  effect_size?: number;
  effect_size_name?: string;
  ci_lower?: number;
  ci_upper?: number;
  degrees_of_freedom?: number;
  significant: boolean;
  interpretation: string;
}

export interface SurvivalResult {
  method: string;
  median_survival?: number;
  ci_lower?: number;
  ci_upper?: number;
  n_events: number;
  n_censored: number;
  survival_probabilities?: Record<string, number>;
  log_rank_p?: number;
  hazard_ratio?: number;
  hr_ci_lower?: number;
  hr_ci_upper?: number;
}

export interface RegressionResult {
  model_type: string;
  dependent_variable: string;
  coefficients: Record<string, any>;
  r_squared?: number;
  adj_r_squared?: number;
  f_statistic?: number;
  f_pvalue?: number;
  aic?: number;
  bic?: number;
  log_likelihood?: number;
  n_observations: number;
  residual_std?: number;
}

export interface RealAnalysisOutput {
  run_id: string;
  status: string;
  analysis_type: string;
  execution_time_ms: number;
  dataset_info: {
    path?: string;
    n_rows: number;
    n_columns: number;
    columns: string[];
  };
  results: {
    analysis_type?: string;
    n_observations?: number;
    execution_time_ms?: number;
    descriptive?: DescriptiveResult[];
    inferential?: InferentialResult[];
    survival?: SurvivalResult[];
    regression?: RegressionResult[];
    correlation_matrix?: Record<string, Record<string, number>>;
    p_value_matrix?: Record<string, Record<string, number>>;
  };
  warnings: string[];
  errors: string[];
  mode: string;
}

export interface AnalysisCapabilities {
  service_available: boolean;
  mode: string;
  analysis_types?: Array<{ type: string; description: string }>;
  statistical_tests?: Array<{ test: string; description: string }>;
  regression_types?: Array<{ type: string; description: string }>;
  correction_methods?: Array<{ method: string; description: string }>;
  scipy_version?: string;
  statsmodels_version?: string;
  lifelines_version?: string;
  pandas_version?: string;
  numpy_version?: string;
  error?: string;
  required_packages?: string[];
}

/**
 * Hook for fetching analysis capabilities
 */
export function useAnalysisCapabilities() {
  return useQuery<AnalysisCapabilities>({
    queryKey: ["/api/ros/analysis/capabilities"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/ros/analysis/capabilities");
      return response.json();
    },
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook for running real statistical analysis
 */
export function useRealAnalysis() {
  const { toast } = useToast();

  return useMutation<RealAnalysisOutput, Error, RealAnalysisInput>({
    mutationFn: async (input) => {
      const response = await apiRequest("POST", "/api/ros/analysis/run", input);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.status === "completed") {
        toast({
          title: "Analysis Complete",
          description: `Real statistical analysis completed in ${data.execution_time_ms}ms`,
        });
      } else if (data.status === "error") {
        toast({
          title: "Analysis Error",
          description: data.errors?.[0] || "An error occurred during analysis",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook for running descriptive analysis
 */
export function useDescriptiveAnalysis() {
  const { toast } = useToast();

  return useMutation<RealAnalysisOutput, Error, { dataset_path?: string; variables?: string[] }>({
    mutationFn: async (input) => {
      const response = await apiRequest("POST", "/api/ros/analysis/descriptive", input);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Descriptive Analysis Complete",
        description: `Analyzed ${data.results?.descriptive?.length || 0} variables`,
      });
    },
    onError: (error) => {
      toast({
        title: "Descriptive Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook for running group comparison (t-test, ANOVA, etc.)
 */
export function useGroupComparison() {
  const { toast } = useToast();

  return useMutation<
    RealAnalysisOutput,
    Error,
    {
      dataset_path?: string;
      group_variable: string;
      outcome_variable: string;
      test_type?: string;
      correction_method?: string;
    }
  >({
    mutationFn: async (input) => {
      const response = await apiRequest("POST", "/api/ros/analysis/compare-groups", input);
      return response.json();
    },
    onSuccess: (data) => {
      const significantCount = data.results?.inferential?.filter((r) => r.significant).length || 0;
      toast({
        title: "Group Comparison Complete",
        description: `${significantCount} significant results found`,
      });
    },
    onError: (error) => {
      toast({
        title: "Group Comparison Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook for running survival analysis
 */
export function useSurvivalAnalysis() {
  const { toast } = useToast();

  return useMutation<
    RealAnalysisOutput,
    Error,
    {
      dataset_path?: string;
      time_variable: string;
      event_variable: string;
      group_variable?: string;
      test_type?: string;
    }
  >({
    mutationFn: async (input) => {
      const response = await apiRequest("POST", "/api/ros/analysis/survival", input);
      return response.json();
    },
    onSuccess: (data) => {
      const survival = data.results?.survival?.[0];
      toast({
        title: "Survival Analysis Complete",
        description: survival?.median_survival
          ? `Median survival: ${survival.median_survival.toFixed(1)}`
          : "Analysis completed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Survival Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook for running regression analysis
 */
export function useRegressionAnalysis() {
  const { toast } = useToast();

  return useMutation<
    RealAnalysisOutput,
    Error,
    {
      dataset_path?: string;
      outcome_variable: string;
      covariates?: string[];
      regression_type?: "linear" | "logistic" | "poisson" | "cox";
    }
  >({
    mutationFn: async (input) => {
      const response = await apiRequest("POST", "/api/ros/analysis/regression", input);
      return response.json();
    },
    onSuccess: (data) => {
      const regression = data.results?.regression?.[0];
      toast({
        title: "Regression Analysis Complete",
        description: regression?.r_squared
          ? `R² = ${regression.r_squared.toFixed(3)}`
          : "Model fitted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Regression Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
