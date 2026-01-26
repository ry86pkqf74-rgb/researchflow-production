export { SlideDeckGenerator } from "./slide-deck-generator";
export type { 
  SlideDeckGeneratorProps, 
  ManuscriptVersion, 
  ConferenceRequirements as SlideConferenceRequirements,
  Slide 
} from "./slide-deck-generator";

export { ComplianceChecklist } from "./compliance-checklist";
export type { 
  ComplianceChecklistProps, 
  ChecklistItem,
  ConferenceRequirement
} from "./compliance-checklist";

export { SubmissionValidator } from "./submission-validator";
export type { 
  SubmissionValidatorProps, 
  SubmissionData, 
  ConferenceRequirements as ValidationConferenceRequirements,
  Author,
  ValidationResult,
  ValidationResponse 
} from "./submission-validator";

export { TalkScript } from "./talk-script";
export type { 
  TalkScriptProps, 
  TalkScriptSection 
} from "./talk-script";
