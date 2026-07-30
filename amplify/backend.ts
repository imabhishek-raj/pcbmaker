import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { generatePcbFunction } from './functions/generate-pcb/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  generatePcbFunction,
});

// Grant Lambda function access to invoke Bedrock models
const lambdaFunc = backend.generatePcbFunction.resources.lambda;
lambdaFunc.addToRolePolicy(
  new PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: ['*'],
  })
);