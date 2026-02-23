import { INodeProperties } from 'n8n-workflow';

export const emailOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: {
      show: {
        resource: ['email'],
      },
    },
    options: [
      {
        name: 'Validate',
        value: 'validate',
        description: 'Validate a single email address',
        action: 'Validate an email',
      },
      {
        name: 'List',
        value: 'list',
        description: 'List previously validated email addresses',
        action: 'List emails',
      },
    ],
    default: 'validate',
  },
];

export const emailFields: INodeProperties[] = [
  // ----------------------------------
  //        email: validate
  // ----------------------------------
  {
    displayName: 'Email Address',
    name: 'email',
    type: 'string',
    required: true,
    default: '',
    placeholder: 'user@example.com',
    description: 'The email address to validate',
    displayOptions: {
      show: {
        resource: ['email'],
        operation: ['validate'],
      },
    },
  },

  // ----------------------------------
  //        email: list
  // ----------------------------------
  {
    displayName: 'Return All',
    name: 'returnAll',
    type: 'boolean',
    default: false,
    description: 'Whether to return all results or only up to a given limit',
    displayOptions: {
      show: {
        resource: ['email'],
        operation: ['list'],
      },
    },
  },
  {
    displayName: 'Limit',
    name: 'limit',
    type: 'number',
    default: 50,
    typeOptions: {
      minValue: 1,
      maxValue: 100,
    },
    description: 'Max number of results to return',
    displayOptions: {
      show: {
        resource: ['email'],
        operation: ['list'],
        returnAll: [false],
      },
    },
  },
  {
    displayName: 'Filters',
    name: 'filters',
    type: 'collection',
    placeholder: 'Add Filter',
    default: {},
    displayOptions: {
      show: {
        resource: ['email'],
        operation: ['list'],
      },
    },
    options: [
      {
        displayName: 'Email State',
        name: 'email_state',
        type: 'options',
        default: '',
        description: 'Filter by validation state',
        options: [
          { name: 'All', value: '' },
          { name: 'OK', value: 'ok' },
          { name: 'Invalid', value: 'invalid' },
          { name: 'Risky', value: 'risky' },
          { name: 'Unknown', value: 'unknown' },
        ],
      },
      {
        displayName: 'Email Sub-State',
        name: 'email_sub_state',
        type: 'options',
        default: '',
        description: 'Filter by validation sub-state',
        options: [
          { name: 'All', value: '' },
          { name: 'Valid (email_ok)', value: 'email_ok' },
          { name: 'Accept All', value: 'accept_all' },
          { name: 'Disposable', value: 'is_disposable' },
          { name: 'Role', value: 'is_role' },
          { name: 'Failed MX Check', value: 'failed_mx_check' },
          { name: 'Failed SMTP Check', value: 'failed_smtp_check' },
          { name: 'No Mailbox', value: 'failed_no_mailbox' },
          { name: 'Greylisted', value: 'failed_greylisted' },
          { name: 'Failed Syntax Check', value: 'failed_syntax_check' },
        ],
      },
      {
        displayName: 'Email Address',
        name: 'email_address',
        type: 'string',
        default: '',
        description: 'Search by email address',
      },
      {
        displayName: 'Batch ID',
        name: 'batch_uuid',
        type: 'string',
        default: '',
        description: 'Filter by batch UUID',
      },
    ],
  },
];
