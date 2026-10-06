import type { ModelProposal, InferenceStage } from '../editor/inference-cache';
export interface ExpertRequest { revision: number; text: string; stage: InferenceStage }
export type ExpertResponse = { revision: number; proposals: ModelProposal[] } | { revision: number; error: string };
