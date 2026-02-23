import {
  IExecuteFunctions,
  IHookFunctions,
  ILoadOptionsFunctions,
  IHttpRequestMethods,
  IHttpRequestOptions,
  IDataObject,
  JsonObject,
  NodeApiError,
} from 'n8n-workflow';

export async function truelistApiRequest(
  this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
  method: IHttpRequestMethods,
  endpoint: string,
  body: IDataObject = {},
  query: IDataObject = {},
  options: Partial<IHttpRequestOptions> = {},
): Promise<IDataObject> {
  const credentials = await this.getCredentials('truelistApi');
  const baseUrl = (credentials.baseUrl as string) || 'https://api.truelist.io';

  const requestOptions: IHttpRequestOptions = {
    method,
    url: `${baseUrl}${endpoint}`,
    headers: {
      'Accept': 'application/json',
      ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
    },
    qs: query,
    body,
    json: true,
    ...options,
  };

  if (Object.keys(body).length === 0) {
    delete requestOptions.body;
  }

  if (Object.keys(query).length === 0) {
    delete requestOptions.qs;
  }

  const apiKey = credentials.apiKey as string;
  requestOptions.headers = {
    ...requestOptions.headers,
    'Authorization': `Bearer ${apiKey}`,
  };

  try {
    return await this.helpers.httpRequest.call(
      this,
      requestOptions,
    ) as IDataObject;
  } catch (error) {
    throw new NodeApiError(this.getNode(), error as JsonObject, {
      message: getErrorMessage(error),
    });
  }
}

export async function truelistApiRequestAllItems(
  this: IExecuteFunctions,
  method: IHttpRequestMethods,
  endpoint: string,
  body: IDataObject = {},
  query: IDataObject = {},
  itemsKey = 'emails',
): Promise<IDataObject[]> {
  const allItems: IDataObject[] = [];
  let page = 1;
  const perPage = 100;

  query.per_page = perPage;

  let hasMore = true;
  while (hasMore) {
    query.page = page;
    const response = await truelistApiRequest.call(this, method, endpoint, body, query);
    const items = (response[itemsKey] as IDataObject[]) || [];

    allItems.push(...items);

    if (items.length < perPage) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allItems;
}

function getErrorMessage(error: unknown): string {
  const err = error as IDataObject;
  const statusCode = (err.httpCode || err.statusCode || '') as string;

  switch (statusCode) {
    case '401':
      return 'Invalid API key. Check your Truelist credentials.';
    case '402':
      return 'Payment issue on your Truelist account. Please update your payment method.';
    case '429':
      return 'Rate limit exceeded. Try again later or enable "Retry on Fail" in node settings.';
    default: {
      const message = (err.message as string) || '';
      if (message) return message;
      return 'An unexpected error occurred while communicating with the Truelist API.';
    }
  }
}
