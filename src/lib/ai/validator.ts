// src/lib/ai/validator.ts
import { z } from 'zod';
import { EvidenceSlice, RequestClassification } from '@/types/database';

export const EvidenceSliceSchema = z.object({
  sourceId: z.string(),
  quote: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});

export const AnalyzedItemSchema = z.object({
  description: z.string().min(1),
  classification: z.enum(['included', 'additional_candidate', 'needs_clarification']),
  reason: z.string().min(1),
  evidence: z.array(EvidenceSliceSchema).default([]),
});

export const AnalysisResultSchema = z.object({
  items: z.array(AnalyzedItemSchema),
});

export type AnalyzedItem = z.infer<typeof AnalyzedItemSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export interface ValidationResultItem {
  description: string;
  classification: RequestClassification;
  ai_classification: RequestClassification;
  reason: string;
  evidence: EvidenceSlice[];
  validationWarning?: string;
}

/**
 * Validates quotes using exact UTF-16 substring matching:
 * sourceText.slice(start, end) === quote.
 *
 * If quote fails or is absent for a deterministic classification ('included' or 'additional_candidate'),
 * degrades classification to 'needs_clarification' and attaches clear warning.
 */
export function validateAndSanitizeAnalysis(
  sourceText: string,
  rawItems: AnalyzedItem[]
): ValidationResultItem[] {
  return rawItems.map(item => {
    const validEvidence: EvidenceSlice[] = [];
    let hasInvalidQuote = false;

    for (const ev of item.evidence) {
      if (ev.start >= 0 && ev.end <= sourceText.length && ev.start <= ev.end) {
        const sliced = sourceText.slice(ev.start, ev.end);
        if (sliced === ev.quote) {
          validEvidence.push(ev);
        } else {
          hasInvalidQuote = true;
        }
      } else {
        hasInvalidQuote = true;
      }
    }

    let finalClassification = item.classification;
    let warning: string | undefined = undefined;

    if (item.classification !== 'needs_clarification') {
      if (validEvidence.length === 0 || hasInvalidQuote) {
        finalClassification = 'needs_clarification';
        warning = '원문 근거 인덱스 불일치 또는 미확인으로 인해 신뢰도를 보장할 수 없어 확인 필요(needs_clarification)로 조정되었습니다.';
      }
    }

    return {
      description: item.description,
      classification: finalClassification,
      ai_classification: item.classification, // record what AI originally suggested
      reason: item.reason + (warning ? ` [시스템: ${warning}]` : ''),
      evidence: validEvidence,
      validationWarning: warning,
    };
  });
}
