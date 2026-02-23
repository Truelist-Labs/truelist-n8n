import { INodeProperties } from 'n8n-workflow';

export const batchOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['batch'],
      },
    },
    options: [
      {
        name: 'Create',
        value: 'create',
        description: 'Create a new batch of emails to validate',
        action: 'Create a batch',
      },
      {
        name: 'Delete',
        value: 'delete',
        description: 'Delete a batch',
        action: 'Delete a batch',
      },
      {
        name: 'Download',
        value: 'download',
        description: 'Download batch results as CSV',
        action: 'Download batch results',
      },
      {
        name: 'Estimate',
        value: 'estimate',
        description: 'Estimate processing time and credit cost for a batch',
        action: 'Estimate a batch',
      },
      {
        name: 'Get',
        value: 'get',
        description: 'Get details of a batch',
        action: 'Get a batch',
      },
      {
        name: 'List',
        value: 'list',
        description: 'List all batches',
        action: 'List batches',
      },
    ],
    default: 'create',
  },
];

export const batchFields: INodeProperties[] = [
  // ----------------------------------
  //        batch: create
  // ----------------------------------
  {
    displayName: 'Emails',
    name: 'emails',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'user1@example.com, user2@example.com',
    description: 'Comma-separated list of email addresses to validate. You can also pass a JSON array of strings via an expression.',
    displayOptions: {
      show: {
        resource: ['batch'],
        operation: ['create'],
      },
    },
  },
  {
    displayName: 'Additional Fields',
    name: 'additionalFields',
    type: 'collection',
    placeholder: 'Add Field',
    default: {},
    displayOptions: {
      show: {
        resource: ['batch'],
        operation: ['create'],
      },
    },
    options: [
      {
        displayName: 'Filename',
        name: 'filename',
        type: 'string',
        default: 'data.csv',
        description: 'Name for this batch',
      },
      {
        displayName: 'Validation Strategy',
        name: 'validation_strategy',
        type: 'options',
        default: 'accurate',
        description: 'The validation strategy to use',
        options: [
          {
            name: 'Fast',
            value: 'fast',
            description: 'SMTP check only. Fastest but least thorough.',
          },
          {
            name: 'Accurate (Default)',
            value: 'accurate',
            description: 'SMTP check only. Balanced speed and accuracy.',
          },
          {
            name: 'Enhanced',
            value: 'enhanced',
            description: 'SMTP + HaveIBeenPwned + Browser validation. Most thorough.',
          },
        ],
      },
      {
        displayName: 'Webhook URL',
        name: 'webhook_url',
        type: 'string',
        default: '',
        placeholder: 'https://your-webhook.example.com/callback',
        description: 'URL to receive a webhook notification when the batch completes',
      },
    ],
  },

  // ----------------------------------
  //        batch: get
  // ----------------------------------
  {
    displayName: 'Batch ID',
    name: 'batchId',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'e.g. a1b2c3d4-e5f6-...',
    description: 'The UUID of the batch',
    displayOptions: {
      show: {
        resource: ['batch'],
        operation: ['get'],
      },
    },
  },

  // ----------------------------------
  //        batch: download
  // ----------------------------------
  {
    displayName: 'Batch ID',
    name: 'batchId',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'e.g. a1b2c3d4-e5f6-...',
    description: 'The UUID of the batch to download results for',
    displayOptions: {
      show: {
        resource: ['batch'],
        operation: ['download'],
      },
    },
  },
  {
    displayName: 'Result Type',
    name: 'selection',
    type: 'options',
    required: true,
    default: 'annotated',
    description: 'Which result set to download',
    displayOptions: {
      show: {
        resource: ['batch'],
        operation: ['download'],
      },
    },
    options: [
      {
        name: 'Annotated (All Emails with Results)',
        value: 'annotated',
        description: 'All emails with their validation results appended',
      },
      {
        name: 'Safest Bet (Most Conservative)',
        value: 'safest',
        description: 'Only emails confirmed as valid',
      },
      {
        name: 'Highest Reach (Most Inclusive)',
        value: 'highest-reach',
        description: 'Valid emails plus accept-all domains',
      },
      {
        name: 'Only Invalid',
        value: 'only-invalid',
        description: 'Only emails that failed validation',
      },
    ],
  },

  // ----------------------------------
  //        batch: delete
  // ----------------------------------
  {
    displayName: 'Batch ID',
    name: 'batchId',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'e.g. a1b2c3d4-e5f6-...',
    description: 'The UUID of the batch to delete',
    displayOptions: {
      show: {
        resource: ['batch'],
        operation: ['delete'],
      },
    },
  },

  // ----------------------------------
  //        batch: estimate
  // ----------------------------------
  {
    displayName: 'Emails',
    name: 'emails',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'user1@example.com, user2@example.com',
    description: 'Comma-separated list of email addresses to estimate',
    displayOptions: {
      show: {
        resource: ['batch'],
        operation: ['estimate'],
      },
    },
  },
];
