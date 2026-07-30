import { defineFunction } from '@aws-amplify/backend';

export const generatePcbFunction = defineFunction({
  name: 'generate-pcb',
  entry: './handler.ts',
  timeoutSeconds: 60,
});