export class NodeApiError extends Error {
  constructor(_node: unknown, error: unknown, options?: { message?: string }) {
    super(options?.message || (error as Error)?.message || 'API Error');
    this.name = 'NodeApiError';
  }
}

export class NodeOperationError extends Error {
  constructor(_node: unknown, message: string, _options?: unknown) {
    super(message);
    this.name = 'NodeOperationError';
  }
}
