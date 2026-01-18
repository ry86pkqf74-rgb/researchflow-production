import { useState, useCallback } from "react";
import { useGovernanceMode } from "./useGovernanceMode";
import { BLOCKED_MESSAGES } from "@/lib/blocked-messages";

export type BlockedMessageCode = keyof typeof BLOCKED_MESSAGES;

export type ActionType = 
  | "view_phi"
  | "export_data"
  | "reveal_phi"
  | "upload_data"
  | "run_analysis"
  | "generate_manuscript";

interface BlockCheckResult {
  isBlocked: boolean;
  messageCode?: BlockedMessageCode;
  params?: Record<string, string>;
}

function checkActionBlocked(
  actionType: ActionType,
  resourceType: string,
  mode: string,
  userRole?: string
): BlockCheckResult {
  const normalizedMode = mode || "STANDBY";
  
  if (normalizedMode === "DEMO") {
    if (actionType === "view_phi" || actionType === "reveal_phi") {
      return {
        isBlocked: true,
        messageCode: "DEMO_PHI_ACCESS",
      };
    }
    if (actionType === "export_data") {
      return {
        isBlocked: true,
        messageCode: "EXPORT_RESTRICTED",
      };
    }
  }

  if (normalizedMode === "STANDBY" || !["DEMO", "LIVE"].includes(normalizedMode)) {
    return {
      isBlocked: true,
      messageCode: "AUDIT_REQUIRED",
    };
  }

  const restrictedRoles = ["VIEWER"];
  if (userRole && restrictedRoles.includes(userRole.toUpperCase())) {
    if (actionType === "reveal_phi") {
      return {
        isBlocked: true,
        messageCode: "PHI_REVEAL_RESTRICTED",
      };
    }
    if (actionType === "export_data" || actionType === "upload_data") {
      return {
        isBlocked: true,
        messageCode: "INSUFFICIENT_ROLE",
        params: { role: userRole, action: `${actionType.replace("_", " ")} for ${resourceType}` },
      };
    }
  }

  return { isBlocked: false };
}

interface UseBlockedActionOptions {
  userRole?: string;
}

interface UseBlockedActionResult {
  execute: (callback: () => void | Promise<void>) => void;
  isBlocked: boolean;
  blockReason?: BlockedMessageCode;
  blockParams?: Record<string, string>;
  showBlockedModal: boolean;
  closeBlockedModal: () => void;
  attemptedAction: string;
}

export function useBlockedAction(
  actionType: ActionType,
  resourceType: string,
  options?: UseBlockedActionOptions
): UseBlockedActionResult {
  const { mode } = useGovernanceMode();
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [attemptedAction, setAttemptedAction] = useState("");

  const checkResult = checkActionBlocked(
    actionType,
    resourceType,
    mode,
    options?.userRole
  );

  const execute = useCallback(
    (callback: () => void | Promise<void>) => {
      if (checkResult.isBlocked) {
        setAttemptedAction(`${actionType.replace("_", " ")} ${resourceType}`);
        setShowBlockedModal(true);
        return;
      }
      callback();
    },
    [actionType, resourceType, checkResult.isBlocked]
  );

  const closeBlockedModal = useCallback(() => {
    setShowBlockedModal(false);
    setAttemptedAction("");
  }, []);

  return {
    execute,
    isBlocked: checkResult.isBlocked,
    blockReason: checkResult.messageCode,
    blockParams: checkResult.params,
    showBlockedModal,
    closeBlockedModal,
    attemptedAction,
  };
}
