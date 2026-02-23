import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class TruelistApi implements ICredentialType {
  name = 'truelistApi';
  displayName = 'Truelist API';
  documentationUrl = 'https://truelist.io/docs/api';

  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Your Truelist API key. Find it in Settings > API Keys at app.truelist.io.',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.truelist.io',
      description: 'The base URL for the Truelist API. Only change this for testing.',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      url: '={{$credentials.baseUrl}}/me',
      method: 'GET',
    },
  };
}
