/**
 * Journal Templates Index
 * Task T53: Export all journal-specific templates
 */

import { NEJM_TEMPLATE } from './nejm.template';
import { JAMA_TEMPLATE } from './jama.template';
import { LANCET_TEMPLATE } from './lancet.template';
import { BMJ_TEMPLATE } from './bmj.template';
import type { ManuscriptTemplate } from '../imrad-templates';

export const JOURNAL_TEMPLATES = {
  nejm: NEJM_TEMPLATE,
  jama: JAMA_TEMPLATE,
  lancet: LANCET_TEMPLATE,
  bmj: BMJ_TEMPLATE,
} as const;

export function getJournalTemplate(journalId: string): ManuscriptTemplate | undefined {
  return JOURNAL_TEMPLATES[journalId as keyof typeof JOURNAL_TEMPLATES];
}

export function listJournalTemplates(): Array<{ id: string; name: string; }> {
  return Object.entries(JOURNAL_TEMPLATES).map(([id, template]) => ({
    id,
    name: template.name,
  }));
}

export { NEJM_TEMPLATE, JAMA_TEMPLATE, LANCET_TEMPLATE, BMJ_TEMPLATE };
