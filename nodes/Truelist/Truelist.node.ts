import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  IDataObject,
  NodeOperationError,
} from 'n8n-workflow';

import {
  truelistApiRequest,
  truelistApiRequestAllItems,
} from './GenericFunctions';

import { emailOperations, emailFields } from './descriptions/EmailDescription';
import { batchOperations, batchFields } from './descriptions/BatchDescription';

export class Truelist implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Truelist',
    name: 'truelist',
    icon: 'file:truelist.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Validate email addresses with Truelist',
    defaults: {
      name: 'Truelist',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'truelistApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Email',
            value: 'email',
          },
          {
            name: 'Batch',
            value: 'batch',
          },
        ],
        default: 'email',
      },
      ...emailOperations,
      ...emailFields,
      ...batchOperations,
      ...batchFields,
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const resource = this.getNodeParameter('resource', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        let responseData: IDataObject | IDataObject[];

        if (resource === 'email') {
          responseData = await executeEmail.call(this, operation, i);
        } else if (resource === 'batch') {
          responseData = await executeBatch.call(this, operation, i);
        } else {
          throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, {
            itemIndex: i,
          });
        }

        const executionData = this.helpers.constructExecutionMetaData(
          this.helpers.returnJsonArray(responseData),
          { itemData: { item: i } },
        );
        returnData.push(...executionData);
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: (error as Error).message },
            pairedItem: { item: i },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}

async function executeEmail(
  this: IExecuteFunctions,
  operation: string,
  index: number,
): Promise<IDataObject | IDataObject[]> {
  if (operation === 'validate') {
    const email = this.getNodeParameter('email', index) as string;
    const response = await truelistApiRequest.call(
      this, 'POST', '/api/v1/verify_inline', { email },
    );
    const emails = (response.emails as IDataObject[]) || [];
    return emails.length > 0 ? emails[0] : response;
  }

  if (operation === 'list') {
    const returnAll = this.getNodeParameter('returnAll', index) as boolean;
    const filters = this.getNodeParameter('filters', index, {}) as IDataObject;
    const query: IDataObject = {};

    if (filters.email_state) query.email_state = filters.email_state;
    if (filters.email_sub_state) query.email_sub_state = filters.email_sub_state;
    if (filters.email_address) query.email_address = filters.email_address;
    if (filters.batch_uuid) query.batch_uuid = filters.batch_uuid;

    if (returnAll) {
      return await truelistApiRequestAllItems.call(
        this, 'GET', '/api/v1/email_addresses', {}, query, 'email_addresses',
      );
    }

    const limit = this.getNodeParameter('limit', index) as number;
    query.per_page = limit;
    query.page = 1;
    const response = await truelistApiRequest.call(
      this, 'GET', '/api/v1/email_addresses', {}, query,
    );
    return (response.email_addresses as IDataObject[]) || [];
  }

  throw new NodeOperationError(this.getNode(), `Unknown email operation: ${operation}`, {
    itemIndex: index,
  });
}

async function executeBatch(
  this: IExecuteFunctions,
  operation: string,
  index: number,
): Promise<IDataObject | IDataObject[]> {
  if (operation === 'create') {
    const emailsInput = this.getNodeParameter('emails', index) as string;
    const additionalFields = this.getNodeParameter('additionalFields', index, {}) as IDataObject;

    const emailList = parseEmails(emailsInput);
    const data = emailList.map((e) => [e]);

    const body: IDataObject = {
      data: JSON.stringify(data),
      filename: (additionalFields.filename as string) || 'data.csv',
    };

    if (additionalFields.validation_strategy) {
      body.validation_strategy = additionalFields.validation_strategy;
    }
    if (additionalFields.webhook_url) {
      body.webhook_url = additionalFields.webhook_url;
    }

    return await truelistApiRequest.call(this, 'POST', '/api/v1/batches', body);
  }

  if (operation === 'get') {
    const batchId = this.getNodeParameter('batchId', index) as string;
    return await truelistApiRequest.call(this, 'GET', `/api/v1/batches/${batchId}`);
  }

  if (operation === 'list') {
    const response = await truelistApiRequest.call(this, 'GET', '/api/v1/batches');
    return (response.batches as IDataObject[]) || (Array.isArray(response) ? response : [response]);
  }

  if (operation === 'download') {
    const batchId = this.getNodeParameter('batchId', index) as string;
    const selection = this.getNodeParameter('selection', index) as string;

    // The download endpoint redirects to a pre-signed S3 URL. Following that redirect
    // with the Authorization header attached causes S3 to return 400. Instead, fetch
    // the batch directly — the show response already includes all pre-signed URLs.
    const batch = await truelistApiRequest.call(this, 'GET', `/api/v1/batches/${batchId}`);

    const urlMap: Record<string, string> = {
      'annotated': 'annotated_csv_url',
      'safest': 'safest_bet_csv_url',
      'highest-reach': 'highest_reach_csv_url',
      'only-invalid': 'only_invalid_csv_url',
    };

    const urlField = urlMap[selection];
    const downloadUrl = urlField ? (batch[urlField] as string) : undefined;

    if (!downloadUrl) {
      throw new NodeOperationError(
        this.getNode(),
        `Download URL not available for "${selection}". The batch may still be processing, or this result type has no emails.`,
        { itemIndex: index },
      );
    }

    // Fetch S3 directly — no auth headers, just the pre-signed URL
    const csvBuffer = await this.helpers.httpRequest({
      method: 'GET',
      url: downloadUrl,
      encoding: 'arraybuffer',
    }) as ArrayBuffer;

    const binaryData = await this.helpers.prepareBinaryData(
      Buffer.from(csvBuffer),
      `truelist-${selection}-${batchId}.csv`,
      'text/csv',
    );

    return { json: { batchId, selection }, binary: { data: binaryData } } as unknown as IDataObject;
  }

  if (operation === 'delete') {
    const batchId = this.getNodeParameter('batchId', index) as string;
    await truelistApiRequest.call(this, 'DELETE', `/api/v1/batches/${batchId}`);
    return { success: true, batchId } as IDataObject;
  }

  if (operation === 'estimate') {
    const emailsInput = this.getNodeParameter('emails', index) as string;
    const emailList = parseEmails(emailsInput);
    const data = emailList.map((e) => [e]);

    return await truelistApiRequest.call(
      this, 'POST', '/api/v1/batches/estimate', { data: JSON.stringify(data) },
    );
  }

  throw new NodeOperationError(this.getNode(), `Unknown batch operation: ${operation}`, {
    itemIndex: index,
  });
}

function parseEmails(input: string): string[] {
  // Handle JSON array input (e.g., from expressions)
  if (input.startsWith('[')) {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed.map((e: string) => e.trim()).filter(Boolean);
      }
    } catch {
      // Fall through to comma-separated parsing
    }
  }

  // Comma or newline separated
  return input
    .split(/[,\n]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}
