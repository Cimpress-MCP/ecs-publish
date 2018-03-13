#!/usr/bin/env node

const eppkg = require('./package.json'),
  program = require('commander');

program.version(eppkg.version);

program
  .command('validate', 'Validate your ecs-publish.json')
  .command('generate-iam-policy', 'Generate an IAM policy for CI/CD that has appropriate permissions for your app')
  .command('obtain-certificate', 'Request an ACM certificate for your service, or display a compatible existing one')
  .command('build', 'Step 1. Build package locally with docker')
  .command('push', 'Step 2. Push image to ECR')
  .command('launch', 'Step 3. Launch image as a service in ECS')
  .command('deploy', 'Steps 1, 2, and 3 in one command. Build, push, and launch')
  .command('test-launch', 'Launch image as a standalone task in ECS, confirm it runs for 30 seconds, then stop it')
  .command('unlaunch', 'Remove the service, target group, and listener rules for the current branch');

program.parse(process.argv);
