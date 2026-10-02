import type { TransformationRequest, TransformationResult } from '../strategies/types';
export interface EditorWorkerRequest { id: number; strategyId: string; request: TransformationRequest }
export type EditorWorkerResponse = { id: number; result: TransformationResult } | { id: number; error: string };
