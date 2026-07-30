import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { generatePcbFunction } from '../functions/generate-pcb/resource';

const schema = a.schema({
  generatePcb: a
    .query()
    .arguments({
      prompt: a.string().required(),
    })
    .returns(a.string())
    .authorization((allow) => [allow.publicApiKey()])
    .handler(a.handler.function(generatePcbFunction)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});