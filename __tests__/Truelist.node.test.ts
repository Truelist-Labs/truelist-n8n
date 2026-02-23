import { Truelist } from '../nodes/Truelist/Truelist.node';
import { NodeOperationError } from 'n8n-workflow';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExecutionContext(overrides: {
  resource?: string;
  operation?: string;
  params?: Record<string, unknown>;
  httpResult?: unknown;
  httpResults?: unknown[];
  continueOnFail?: boolean;
}) {
  const {
    resource = 'email',
    operation = 'validate',
    params = {},
    httpResult = {},
    httpResults,
    continueOnFail = false,
  } = overrides;

  const paramMap: Record<string, unknown> = {
    resource,
    operation,
    ...params,
  };

  let httpCallCount = 0;

  const ctx = {
    getInputData: jest.fn().mockReturnValue([{ json: {} }]),
    getNodeParameter: jest.fn().mockImplementation((name: string, _index: number, defaultValue?: unknown) => {
      if (name in paramMap) return paramMap[name];
      if (defaultValue !== undefined) return defaultValue;
      return undefined;
    }),
    getNode: jest.fn().mockReturnValue({ name: 'Truelist' }),
    getCredentials: jest.fn().mockResolvedValue({
      apiKey: 'test-key',
      baseUrl: 'https://api.example.com',
    }),
    continueOnFail: jest.fn().mockReturnValue(continueOnFail),
    helpers: {
      httpRequest: jest.fn().mockImplementation(() => {
        if (httpResults) {
          return Promise.resolve(httpResults[httpCallCount++] ?? {});
        }
        return Promise.resolve(httpResult);
      }),
      constructExecutionMetaData: jest.fn().mockImplementation((data: unknown[], meta: unknown) =>
        data.map((item) => ({ ...(item as object), pairedItem: (meta as any).itemData })),
      ),
      returnJsonArray: jest.fn().mockImplementation((data: unknown) =>
        Array.isArray(data) ? data.map((d) => ({ json: d })) : [{ json: data }],
      ),
      prepareBinaryData: jest.fn().mockResolvedValue({ mimeType: 'text/csv', data: 'base64data' }),
    },
  };

  return ctx;
}

async function executeNode(ctx: ReturnType<typeof makeExecutionContext>) {
  const node = new Truelist();
  return node.execute.call(ctx as any);
}

// ---------------------------------------------------------------------------
// Email resource
// ---------------------------------------------------------------------------

describe('Truelist node — email resource', () => {
  describe('validate operation', () => {
    it('POSTs to /api/v1/verify_inline and returns the first email result', async () => {
      const emailResult = { email: 'test@example.com', state: 'ok' };
      const ctx = makeExecutionContext({
        resource: 'email',
        operation: 'validate',
        params: { email: 'test@example.com' },
        httpResult: { emails: [emailResult] },
      });

      const [[result]] = await executeNode(ctx);

      expect(ctx.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://api.example.com/api/v1/verify_inline',
          body: { email: 'test@example.com' },
        }),
      );
      expect(result.json).toEqual(emailResult);
    });

    it('returns the full response when emails array is empty', async () => {
      const ctx = makeExecutionContext({
        resource: 'email',
        operation: 'validate',
        params: { email: 'test@example.com' },
        httpResult: { emails: [], message: 'queued' },
      });

      const [[result]] = await executeNode(ctx);
      expect(result.json).toEqual({ emails: [], message: 'queued' });
    });
  });

  describe('list operation', () => {
    it('GETs /api/v1/email_addresses with limit and returns email_addresses array', async () => {
      const addresses = [{ email: 'a@b.com' }, { email: 'c@d.com' }];
      const ctx = makeExecutionContext({
        resource: 'email',
        operation: 'list',
        params: { returnAll: false, limit: 25, filters: {} },
        httpResult: { email_addresses: addresses },
      });

      const [[result1, result2]] = await executeNode(ctx);

      expect(ctx.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.example.com/api/v1/email_addresses',
          qs: { per_page: 25, page: 1 },
        }),
      );
      expect(result1.json).toEqual(addresses[0]);
      expect(result2.json).toEqual(addresses[1]);
    });

    it('applies filters to the query string', async () => {
      const ctx = makeExecutionContext({
        resource: 'email',
        operation: 'list',
        params: {
          returnAll: false,
          limit: 10,
          filters: { email_state: 'ok', email_sub_state: 'email_ok', batch_uuid: 'abc-123' },
        },
        httpResult: { email_addresses: [] },
      });

      await executeNode(ctx);

      expect(ctx.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          qs: expect.objectContaining({
            email_state: 'ok',
            email_sub_state: 'email_ok',
            batch_uuid: 'abc-123',
          }),
        }),
      );
    });

    it('paginates all results when returnAll is true', async () => {
      const page1 = Array.from({ length: 100 }, (_, i) => ({ id: `email-${i}` }));
      const page2 = [{ id: 'email-100' }];

      const ctx = makeExecutionContext({
        resource: 'email',
        operation: 'list',
        params: { returnAll: true, filters: {} },
        httpResults: [{ email_addresses: page1 }, { email_addresses: page2 }],
      });

      const [results] = await executeNode(ctx);
      expect(results).toHaveLength(101);
    });
  });

  describe('unknown operation', () => {
    it('throws NodeOperationError', async () => {
      const ctx = makeExecutionContext({ resource: 'email', operation: 'nonexistent' });

      await expect(executeNode(ctx)).rejects.toThrow(NodeOperationError);
      await expect(executeNode(ctx)).rejects.toThrow('Unknown email operation: nonexistent');
    });
  });
});

// ---------------------------------------------------------------------------
// Batch resource
// ---------------------------------------------------------------------------

describe('Truelist node — batch resource', () => {
  describe('create operation', () => {
    it('POSTs to /api/v1/batches with serialized email data', async () => {
      const batchResponse = { id: 'batch-uuid', email_count: 3 };
      const ctx = makeExecutionContext({
        resource: 'batch',
        operation: 'create',
        params: {
          emails: 'a@a.com, b@b.com, c@c.com',
          additionalFields: { filename: 'upload.csv' },
        },
        httpResult: batchResponse,
      });

      const [[result]] = await executeNode(ctx);

      expect(ctx.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://api.example.com/api/v1/batches',
          body: expect.objectContaining({
            data: JSON.stringify([['a@a.com'], ['b@b.com'], ['c@c.com']]),
            filename: 'upload.csv',
          }),
        }),
      );
      expect(result.json).toEqual(batchResponse);
    });

    it('parses a JSON array of emails from an expression', async () => {
      const ctx = makeExecutionContext({
        resource: 'batch',
        operation: 'create',
        params: {
          emails: JSON.stringify(['x@x.com', 'y@y.com']),
          additionalFields: {},
        },
        httpResult: { id: 'uuid' },
      });

      await executeNode(ctx);

      const callArg = (ctx.helpers.httpRequest as jest.Mock).mock.calls[0][0];
      expect(callArg.body.data).toEqual(JSON.stringify([['x@x.com'], ['y@y.com']]));
    });

    it('includes optional validation_strategy and webhook_url', async () => {
      const ctx = makeExecutionContext({
        resource: 'batch',
        operation: 'create',
        params: {
          emails: 'a@a.com',
          additionalFields: {
            validation_strategy: 'enhanced',
            webhook_url: 'https://hook.example.com',
          },
        },
        httpResult: { id: 'uuid' },
      });

      await executeNode(ctx);

      expect(ctx.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            validation_strategy: 'enhanced',
            webhook_url: 'https://hook.example.com',
          }),
        }),
      );
    });

    it('defaults filename to data.csv when not provided', async () => {
      const ctx = makeExecutionContext({
        resource: 'batch',
        operation: 'create',
        params: { emails: 'a@a.com', additionalFields: {} },
        httpResult: { id: 'uuid' },
      });

      await executeNode(ctx);

      const callArg = (ctx.helpers.httpRequest as jest.Mock).mock.calls[0][0];
      expect(callArg.body.filename).toBe('data.csv');
    });
  });

  describe('get operation', () => {
    it('GETs the correct batch endpoint', async () => {
      const batchResponse = { id: 'my-batch', batch_state: 'completed' };
      const ctx = makeExecutionContext({
        resource: 'batch',
        operation: 'get',
        params: { batchId: 'my-batch' },
        httpResult: batchResponse,
      });

      const [[result]] = await executeNode(ctx);

      expect(ctx.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.example.com/api/v1/batches/my-batch',
        }),
      );
      expect(result.json).toEqual(batchResponse);
    });
  });

  describe('list operation', () => {
    it('GETs /api/v1/batches and returns the batches array', async () => {
      const batches = [{ id: '1' }, { id: '2' }];
      const ctx = makeExecutionContext({
        resource: 'batch',
        operation: 'list',
        httpResult: { batches },
      });

      const [results] = await executeNode(ctx);
      expect(results).toHaveLength(2);
      expect(results[0].json).toEqual({ id: '1' });
    });

    it('handles a plain array response', async () => {
      const ctx = makeExecutionContext({
        resource: 'batch',
        operation: 'list',
        httpResult: [{ id: '1' }],
      });

      const [results] = await executeNode(ctx);
      expect(results).toHaveLength(1);
    });
  });

  describe('download operation', () => {
    it('fetches the batch then downloads the pre-signed S3 URL', async () => {
      const s3Url = 'https://s3.example.com/file.csv?signed=true';
      const batchResponse = { id: 'batch-123', annotated_csv_url: s3Url };

      const ctx = makeExecutionContext({
        resource: 'batch',
        operation: 'download',
        params: { batchId: 'batch-123', selection: 'annotated' },
        httpResults: [batchResponse, Buffer.from('csv,data')],
      });

      await executeNode(ctx);

      // First call: GET the batch for the pre-signed URLs (authenticated via httpRequest)
      expect(ctx.helpers.httpRequest).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.example.com/api/v1/batches/batch-123',
        }),
      );

      // Second call: unauthenticated fetch of the S3 URL
      expect(ctx.helpers.httpRequest).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ method: 'GET', url: s3Url }),
      );
    });

    it('throws NodeOperationError when the download URL is not available', async () => {
      const ctx = makeExecutionContext({
        resource: 'batch',
        operation: 'download',
        params: { batchId: 'batch-123', selection: 'safest' },
        httpResult: { id: 'batch-123' }, // no safest_bet_csv_url
      });

      await expect(executeNode(ctx)).rejects.toThrow(NodeOperationError);
      await expect(executeNode(ctx)).rejects.toThrow('Download URL not available');
    });

    it('maps all four selection types to the correct URL fields', async () => {
      const selections = [
        { selection: 'annotated', field: 'annotated_csv_url' },
        { selection: 'safest', field: 'safest_bet_csv_url' },
        { selection: 'highest-reach', field: 'highest_reach_csv_url' },
        { selection: 'only-invalid', field: 'only_invalid_csv_url' },
      ] as const;

      for (const { selection, field } of selections) {
        const s3Url = `https://s3.example.com/${selection}.csv`;
        const batchResponse = { id: 'batch-123', [field]: s3Url };

        const ctx = makeExecutionContext({
          resource: 'batch',
          operation: 'download',
          params: { batchId: 'batch-123', selection },
          httpResults: [batchResponse, Buffer.from('csv,data')],
        });

        await executeNode(ctx);
        expect(ctx.helpers.httpRequest).toHaveBeenNthCalledWith(
          2,
          expect.objectContaining({ url: s3Url }),
        );
      }
    });
  });

  describe('delete operation', () => {
    it('sends DELETE to the correct batch endpoint', async () => {
      const ctx = makeExecutionContext({
        resource: 'batch',
        operation: 'delete',
        params: { batchId: 'batch-to-delete' },
        httpResult: {},
      });

      const [[result]] = await executeNode(ctx);

      expect(ctx.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: 'https://api.example.com/api/v1/batches/batch-to-delete',
        }),
      );
      expect(result.json).toEqual({ success: true, batchId: 'batch-to-delete' });
    });
  });

  describe('estimate operation', () => {
    it('POSTs to /api/v1/batches/estimate with serialized email data', async () => {
      const estimateResponse = { credit_cost: 5, processing_time_seconds: 10 };
      const ctx = makeExecutionContext({
        resource: 'batch',
        operation: 'estimate',
        params: { emails: 'a@a.com\nb@b.com' },
        httpResult: estimateResponse,
      });

      const [[result]] = await executeNode(ctx);

      expect(ctx.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: 'https://api.example.com/api/v1/batches/estimate',
          body: { data: JSON.stringify([['a@a.com'], ['b@b.com']]) },
        }),
      );
      expect(result.json).toEqual(estimateResponse);
    });
  });

  describe('unknown operation', () => {
    it('throws NodeOperationError', async () => {
      const ctx = makeExecutionContext({ resource: 'batch', operation: 'nonexistent' });

      await expect(executeNode(ctx)).rejects.toThrow(NodeOperationError);
      await expect(executeNode(ctx)).rejects.toThrow('Unknown batch operation: nonexistent');
    });
  });
});

// ---------------------------------------------------------------------------
// Unknown resource
// ---------------------------------------------------------------------------

describe('Truelist node — unknown resource', () => {
  it('throws NodeOperationError', async () => {
    const ctx = makeExecutionContext({ resource: 'unknown' });

    await expect(executeNode(ctx)).rejects.toThrow(NodeOperationError);
    await expect(executeNode(ctx)).rejects.toThrow('Unknown resource: unknown');
  });
});

// ---------------------------------------------------------------------------
// continueOnFail behaviour
// ---------------------------------------------------------------------------

describe('Truelist node — continueOnFail', () => {
  it('returns error in item data instead of throwing when continueOnFail is true', async () => {
    const ctx = makeExecutionContext({
      resource: 'batch',
      operation: 'nonexistent',
      continueOnFail: true,
    });

    const [results] = await executeNode(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].json).toEqual({ error: 'Unknown batch operation: nonexistent' });
  });
});

// ---------------------------------------------------------------------------
// parseEmails (tested via batch create / estimate)
// ---------------------------------------------------------------------------

describe('parseEmails (via batch operations)', () => {
  it('parses comma-separated emails', async () => {
    const ctx = makeExecutionContext({
      resource: 'batch',
      operation: 'create',
      params: { emails: 'a@a.com, b@b.com', additionalFields: {} },
      httpResult: { id: 'uuid' },
    });

    await executeNode(ctx);

    const callArg = (ctx.helpers.httpRequest as jest.Mock).mock.calls[0][0];
    expect(callArg.body.data).toEqual(JSON.stringify([['a@a.com'], ['b@b.com']]));
  });

  it('parses newline-separated emails', async () => {
    const ctx = makeExecutionContext({
      resource: 'batch',
      operation: 'create',
      params: { emails: 'a@a.com\nb@b.com\nc@c.com', additionalFields: {} },
      httpResult: { id: 'uuid' },
    });

    await executeNode(ctx);

    const callArg = (ctx.helpers.httpRequest as jest.Mock).mock.calls[0][0];
    expect(callArg.body.data).toEqual(
      JSON.stringify([['a@a.com'], ['b@b.com'], ['c@c.com']]),
    );
  });

  it('parses a JSON array string from an expression', async () => {
    const ctx = makeExecutionContext({
      resource: 'batch',
      operation: 'create',
      params: { emails: '["x@x.com","y@y.com"]', additionalFields: {} },
      httpResult: { id: 'uuid' },
    });

    await executeNode(ctx);

    const callArg = (ctx.helpers.httpRequest as jest.Mock).mock.calls[0][0];
    expect(callArg.body.data).toEqual(JSON.stringify([['x@x.com'], ['y@y.com']]));
  });

  it('falls back to comma parsing when JSON array is malformed', async () => {
    const ctx = makeExecutionContext({
      resource: 'batch',
      operation: 'create',
      params: { emails: '[invalid json, a@a.com', additionalFields: {} },
      httpResult: { id: 'uuid' },
    });

    await executeNode(ctx);

    const callArg = (ctx.helpers.httpRequest as jest.Mock).mock.calls[0][0];
    // Falls back to comma-split: '[invalid json' and ' a@a.com'
    const parsed = JSON.parse(callArg.body.data as string);
    expect(parsed.some((e: string[]) => e[0].includes('a@a.com'))).toBe(true);
  });

  it('filters out blank entries', async () => {
    const ctx = makeExecutionContext({
      resource: 'batch',
      operation: 'create',
      params: { emails: 'a@a.com,,  ,b@b.com', additionalFields: {} },
      httpResult: { id: 'uuid' },
    });

    await executeNode(ctx);

    const callArg = (ctx.helpers.httpRequest as jest.Mock).mock.calls[0][0];
    expect(callArg.body.data).toEqual(JSON.stringify([['a@a.com'], ['b@b.com']]));
  });
});
