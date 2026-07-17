import { z } from "zod";
import { Category } from "@/lib/enums";

export const PrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export type Priority = z.infer<typeof PrioritySchema>;

export const TriageOutputSchema = z.object({
  category: z.enum(["IT", "HR", "FACILITIES", "OTHER"]),
  priority: PrioritySchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1),
  tags: z.array(z.string()).default([]),
});
export type TriageOutput = z.infer<typeof TriageOutputSchema>;

export const KnowledgeOutputSchema = z.object({
  relevant: z.boolean(),
  summary: z.string(),
  citations: z.array(
    z.object({
      documentTitle: z.string(),
      excerpt: z.string(),
      score: z.number().min(0).max(1),
    }),
  ),
  suggestedSteps: z.array(z.string()).default([]),
});
export type KnowledgeOutput = z.infer<typeof KnowledgeOutputSchema>;

export const ResolutionOutputSchema = z.object({
  draftResponse: z.string().min(1),
  recommendedActions: z.array(z.string()).default([]),
  needsHumanReview: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type ResolutionOutput = z.infer<typeof ResolutionOutputSchema>;

export const EvaluatorOutputSchema = z.object({
  approved: z.boolean(),
  issues: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  notes: z.string(),
});
export type EvaluatorOutput = z.infer<typeof EvaluatorOutputSchema>;

export type AgentName =
  | "retriever_db"
  | "retriever_pdf"
  | "triage"
  | "knowledge"
  | "resolution"
  | "evaluator";

export type RetrievalHit = {
  id: string;
  title: string;
  excerpt: string;
  score: number;
  sourceType: "ticket" | "pdf";
  sourceRef?: string;
};

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmProvider = {
  name: string;
  complete(messages: LlmMessage[], options?: { temperature?: number }): Promise<string>;
};

export function categoryFromString(value: string): Category {
  const upper = value.toUpperCase();
  if (upper === "IT" || upper === "HR" || upper === "FACILITIES" || upper === "OTHER") {
    return upper;
  }
  return "OTHER";
}
