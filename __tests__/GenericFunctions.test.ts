import { truelistApiRequest, truelistApiRequestAllItems } from '../nodes/Truelist/GenericFunctions';
import { NodeApiError } from 'n8n-workflow';

function makeContext(httpResult: unknown = {}) {
  return {
    getCredentials: jest.fn().mockResolvedValue({
      apiKey: 'test-key',
      baseUrl: 'https://api.example.com',
    }),
    getNode: jest.fn().mockReturnValue({ name: 'Truelist' }),
    helpers: {
      httpRequest: jest.fn().mockResolvedValue(httpResult),
    },
  };
}

describe('truelistApiRequest', () => {
  describe('request construction', () => {
    it('sends a GET request to the correct URL', async () => {
      const ctx = makeContext({ batches: [] });
      await truelistApiRequest.call(ctx as any, 'GET', '/api/v1/batches');

      expect(ctx.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://api.example.com/api/v1/batches',
          json: true,
        }),
      );
    });

    it('sends a POST request with a body', async () => {
      const ctx = makeContext({ id: 'abc' });
      await truelistApiRequest.call(ctx as any, 'POST', '/api/v1/batches', { data: '[]' });

      expect(ctx.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          body: { data: '[]' },
        }),
      );
    });

    it('omits body key when body is empty', async () => {
      const ctx = makeContext({});
      await truelistApiRequest.call(ctx as any, 'GET', '/me');

      const callArg = (ctx.helpers.httpRequest as jest.Mock).mock.calls[0][0];
      expect(callArg).not.toHaveProperty('body');
    });

    it('passes query params via qs', async () => {
      const ctx = makeContext({ email_addresses: [] });
      await truelistApiRequest.call(
        ctx as any,
        'GET',
        '/api/v1/email_addresses',
        {},
        { page: 1, per_page: 50 },
      );

      expect(ctx.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({ qs: { page: 1, per_page: 50 } }),
      );
    });

    it('omits qs key when query is empty', async () => {
      const ctx = makeContext({});
      await truelistApiRequest.call(ctx as any, 'GET', '/api/v1/batches');

      const callArg = (ctx.helpers.httpRequest as jest.Mock).mock.calls[0][0];
      expect(callArg).not.toHaveProperty('qs');
    });

    it('uses default base URL when not set in credentials', async () => {
      const ctx = {
        ...makeContext(),
        getCredentials: jest.fn().mockResolvedValue({ apiKey: 'key' }),
      };
      await truelistApiRequest.call(ctx as any, 'GET', '/api/v1/batches');

      expect(ctx.helpers.httpRequest).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://api.truelist.io/api/v1/batches' }),
      );
    });

    it('sets Authorization header with the API key', async () => {
      const ctx = makeContext({});
      await truelistApiRequest.call(ctx as any, 'GET', '/api/v1/batches');

      const callArg = (ctx.helpers.httpRequest as jest.Mock).mock.calls[0][0];
      expect(callArg.headers).toMatchObject({ Authorization: 'Bearer test-key' });
    });

    it('does not send Content-Type on GET requests', async () => {
      const ctx = makeContext({});
      await truelistApiRequest.call(ctx as any, 'GET', '/api/v1/email_addresses');

      const callArg = (ctx.helpers.httpRequest as jest.Mock).mock.calls[0][0];
      expect(callArg.headers).not.toHaveProperty('Content-Type');
    });

    it('sends Content-Type application/json on POST requests', async () => {
      const ctx = makeContext({ id: 'abc' });
      await truelistApiRequest.call(ctx as any, 'POST', '/api/v1/batches', { name: 'test' });

      const callArg = (ctx.helpers.httpRequest as jest.Mock).mock.calls[0][0];
      expect(callArg.headers).toMatchObject({ 'Content-Type': 'application/json' });
    });

    it('returns the parsed response', async () => {
      const payload = { id: 'abc', email_count: 10 };
      const ctx = makeContext(payload);

      const result = await truelistApiRequest.call(ctx as any, 'GET', '/api/v1/batches/abc');
      expect(result).toEqual(payload);
    });
  });

  describe('error handling', () => {
    it('throws NodeApiError with 401 message on HTTP 401', async () => {
      const ctx = makeContext();
      (ctx.helpers.httpRequest as jest.Mock).mockRejectedValue(
        Object.assign(new Error(), { httpCode: '401' }),
      );

      await expect(
        truelistApiRequest.call(ctx as any, 'GET', '/api/v1/batches'),
      ).rejects.toThrow('Invalid API key. Check your Truelist credentials.');
      await expect(
        truelistApiRequest.call(ctx as any, 'GET', '/api/v1/batches'),
      ).rejects.toBeInstanceOf(NodeApiError);
    });

    it('throws NodeApiError with 402 message on HTTP 402', async () => {
      const ctx = makeContext();
      (ctx.helpers.httpRequest as jest.Mock).mockRejectedValue(
        Object.assign(new Error(), { httpCode: '402' }),
      );

      await expect(
        truelistApiRequest.call(ctx as any, 'GET', '/api/v1/batches'),
      ).rejects.toThrow('Payment issue on your Truelist account. Please update your payment method.');
    });

    it('throws NodeApiError with 429 message on HTTP 429', async () => {
      const ctx = makeContext();
      (ctx.helpers.httpRequest as jest.Mock).mockRejectedValue(
        Object.assign(new Error(), { httpCode: '429' }),
      );

      await expect(
        truelistApiRequest.call(ctx as any, 'GET', '/api/v1/batches'),
      ).rejects.toThrow('Rate limit exceeded. Try again later or enable "Retry on Fail" in node settings.');
    });

    it('throws NodeApiError with error message for unknown status codes', async () => {
      const ctx = makeContext();
      (ctx.helpers.httpRequest as jest.Mock).mockRejectedValue(
        Object.assign(new Error(), { httpCode: '500', message: 'Internal server error' }),
      );

      await expect(
        truelistApiRequest.call(ctx as any, 'GET', '/api/v1/batches'),
      ).rejects.toThrow('Internal server error');
    });

    it('falls back to generic message when error has no message or status', async () => {
      const ctx = makeContext();
      (ctx.helpers.httpRequest as jest.Mock).mockRejectedValue({});

      await expect(
        truelistApiRequest.call(ctx as any, 'GET', '/api/v1/batches'),
      ).rejects.toThrow('An unexpected error occurred while communicating with the Truelist API.');
    });
  });
});

describe('truelistApiRequestAllItems', () => {
  it('returns all items across multiple pages', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    const page2 = Array.from({ length: 30 }, (_, i) => ({ id: 100 + i }));

    const ctx = makeContext();
    (ctx.helpers.httpRequest as jest.Mock)
      .mockResolvedValueOnce({ email_addresses: page1 })
      .mockResolvedValueOnce({ email_addresses: page2 });

    const result = await truelistApiRequestAllItems.call(
      ctx as any,
      'GET',
      '/api/v1/email_addresses',
      {},
      {},
      'email_addresses',
    );

    expect(result).toHaveLength(130);
    expect(ctx.helpers.httpRequest).toHaveBeenCalledTimes(2);
  });

  it('stops paginating when a page returns fewer items than perPage', async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => ({ id: i }));

    const ctx = makeContext({ email_addresses: page1 });

    const result = await truelistApiRequestAllItems.call(
      ctx as any,
      'GET',
      '/api/v1/email_addresses',
      {},
      {},
      'email_addresses',
    );

    expect(result).toHaveLength(50);
    expect(ctx.helpers.httpRequest).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when the response key is missing', async () => {
    const ctx = makeContext({});

    const result = await truelistApiRequestAllItems.call(
      ctx as any,
      'GET',
      '/api/v1/email_addresses',
      {},
      {},
      'email_addresses',
    );

    expect(result).toEqual([]);
  });

  it('uses page and per_page query params on each request', async () => {
    const ctx = makeContext({ email_addresses: [] });

    await truelistApiRequestAllItems.call(
      ctx as any,
      'GET',
      '/api/v1/email_addresses',
      {},
      { email_state: 'ok' },
      'email_addresses',
    );

    expect(ctx.helpers.httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        qs: expect.objectContaining({ page: 1, per_page: 100, email_state: 'ok' }),
      }),
    );
  });
});
