import type { PreparedInference } from '../editor/inference-cache';
import type { TransformationRequest, TransformationResult } from '../strategies/types';
export interface EditorWorkerRequest { id: number; strategyId: string; request: TransformationRequest; prepared?: PreparedInference }
export type EditorWorkerResponse = { id: number; result: TransformationResult } | { id: number; error: string };
