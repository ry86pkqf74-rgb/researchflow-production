export interface BlockedMessage {
  title: string;
  description: string;
  suggestion: string;
  learnMoreUrl?: string;
}

export const BLOCKED_MESSAGES = {
  DEMO_PHI_ACCESS: {
    title: "PHI Access Restricted in Demo Mode",
    description: "Protected Health Information cannot be viewed in Demo mode to ensure data privacy.",
    suggestion: "Switch to Identified or Production mode to access patient data.",
    learnMoreUrl: "/docs/governance-modes"
  },
  INSUFFICIENT_ROLE: {
    title: "Permission Required",
    description: "Your current role ({role}) does not have permission to {action}.",
    suggestion: "Contact your administrator to request elevated access.",
    learnMoreUrl: "/docs/user-roles"
  },
  EXPORT_RESTRICTED: {
    title: "Export Not Available",
    description: "Data export is restricted in the current governance mode.",
    suggestion: "Request export approval from a Data Steward.",
    learnMoreUrl: "/docs/data-export"
  },
  PHI_REVEAL_RESTRICTED: {
    title: "Cannot Reveal Sensitive Data",
    description: "Your role does not permit revealing redacted PHI.",
    suggestion: "A Steward or Admin can reveal this information if needed.",
    learnMoreUrl: "/docs/phi-redaction"
  },
  AUDIT_REQUIRED: {
    title: "Audit Logging Required",
    description: "This action requires audit logging which is not currently enabled.",
    suggestion: "Enable audit logging in settings or contact your administrator.",
    learnMoreUrl: "/docs/audit-logging"
  }
} as const;

export function getBlockedMessage(
  code: keyof typeof BLOCKED_MESSAGES,
  params?: Record<string, string>
): BlockedMessage {
  const template = BLOCKED_MESSAGES[code];
  
  if (!params) {
    return { ...template };
  }

  let description: string = template.description;
  for (const [key, value] of Object.entries(params)) {
    description = description.replace(`{${key}}`, value);
  }

  return {
    ...template,
    description
  };
}
