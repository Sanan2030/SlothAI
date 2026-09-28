export interface EditorKeyIntent {
  key: string;
  shiftKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
}

/** Plain Enter submits correction; Shift+Enter remains available for a line break. */
export function shouldSubmitEditorKey(intent: EditorKeyIntent): boolean {
  return intent.key === 'Enter' && !intent.shiftKey && !intent.altKey && !intent.isComposing;
}
