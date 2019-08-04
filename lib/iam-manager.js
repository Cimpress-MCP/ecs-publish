'use strict';
const IAM = require('aws-sdk/clients/iam'),
  logger = require('./logger');

module.exports.listRoles = function ({ cfg }) {
  if (!cfg.taskDefinitionTemplate) throw new Error('ExitGracefully');
  const iam = new IAM({ region: cfg.region });
  return iam.listRoles().promise()
    .then((data) => {
      if (cfg.taskDefinitionTemplate && cfg.taskDefinitionTemplate.executionRole) {
        const executionRoles = data.Roles.filter((role) => { return role.RoleName === cfg.taskDefinitionTemplate.executionRole; });
        if (executionRoles.length !== 1) throw new Error(`Execution role ${cfg.taskDefinitionTemplate.executionRole} does not exist.`);
        cfg.executionRoleArn = executionRoles[0].Arn;
      }
      return { cfg, data };
    });
};

module.exports.ensureTaskRoleExists = function ({ cfg, data }) {
  if (!cfg.taskRole) return { cfg };
  const iam = new IAM({ region: cfg.region });
  if (cfg.taskRole && cfg.taskRole.roleArn) {
    logger.action(`Checking if task role '${cfg.taskRole.roleArn}' already exists...`);
    const existingRoles = data.Roles.filter((role) => { return role.Arn === cfg.taskRole.roleArn; });
    if (existingRoles.length === 1) {
      return new Promise((resolve) => {
        logger.result(`${existingRoles[0].Arn}`);
        cfg.taskRoleArn = existingRoles[0].Arn;
        return resolve({ cfg, taskRole: existingRoles[0] });
      });
    }
    return new Promise((resolve, reject) => { return reject(new Error(`Role ${cfg.taskRole.roleArn} does not exist.`)); });
  } else {
    const taskRoleName = `${cfg.safePkgName}-ecs-task-role`;
    logger.action(`Checking if task role ${taskRoleName} already exists...`);
    const existingRoles = data.Roles.filter((role) => { return role.RoleName === taskRoleName; });
    if (existingRoles.length === 1) {
      return new Promise((resolve) => {
        logger.result(`${existingRoles[0].Arn}`);
        cfg.taskRoleArn = existingRoles[0].Arn;
        return resolve({ cfg, taskRole: existingRoles[0] });
      });
    }
    return iam.createRole({
      AssumeRolePolicyDocument: JSON.stringify({
        'Version': '2012-10-17',
        'Statement': [
          {
            'Sid': '',
            'Effect': 'Allow',
            'Principal': {
              'Service': 'ecs-tasks.amazonaws.com'
            },
            'Action': 'sts:AssumeRole'
          }
        ]
      }),
      RoleName: taskRoleName,
      Description: `Task role for ${cfg.fullName} ECS task`
    }).promise()
      .then((data) => {
        cfg.taskRoleArn = data.Role.Arn;
        logger.result(`created ${cfg.taskRoleArn}`);
        return { cfg, taskRole: data.Role };
      });
  }
};

module.exports.ensureTaskRolePolicyIsUpToDate = function ({ cfg, taskRole }) {
  if (!taskRole || (cfg.taskRole && cfg.taskRole.roleArn)) return { cfg };
  const iam = new IAM({ region: cfg.region });
  logger.action(`Ensuring task role policy is up to date...`);
  return iam.putRolePolicy({
    PolicyDocument: JSON.stringify(cfg.taskRole.policyDocument),
    PolicyName: 'ecs-task-role-policy',
    RoleName: taskRole.RoleName
  }).promise()
    .then(() => {
      logger.result('Done');
      return { cfg };
    });
};

module.exports.generateCiCdIamPolicy = function ({ cfg }) {
  const policy = { Version: '2012-10-17' };
  policy.Statement = [
    {
      Effect: 'Allow',
      Action: [
        'ecr:DescribeImages',
        'ecr:PutImage',
        'ecr:InitiateLayerUpload',
        'ecr:UploadLayerPart',
        'ecr:CompleteLayerUpload',
        'ecr:BatchCheckLayerAvailability'
      ],
      Resource: `arn:aws:ecr:${cfg.region}:${cfg.accountId}:repository/${cfg.safePkgName}*`
    },
    {
      Effect: 'Allow',
      Action: 'ecr:CreateRepository',
      Resource: '*'
    },
    {
      Effect: 'Allow',
      Action: [
        'ecr:DescribeRepositories',
        'ecr:GetAuthorizationToken',
        'acm:ListCertificates',
        'acm:DescribeCertificate',
        'acm:RequestCertificate',
        'elasticloadbalancing:DescribeLoadBalancers',
        'elasticloadbalancing:DescribeTargetGroups',
        'elasticloadbalancing:DescribeTargetGroupAttributes',
        'elasticloadbalancing:DescribeListeners',
        'elasticloadbalancing:DescribeRules',
        'elasticloadbalancing:CreateTargetGroup',
        'elasticloadbalancing:CreateRule',
        'elasticloadbalancing:ModifyTargetGroup',
        'elasticloadbalancing:ModifyTargetGroupAttributes',
        'elasticloadbalancing:ModifyListener',
        'elasticloadbalancing:DeleteRule',
        'elasticloadbalancing:DeleteTargetGroup',
        'iam:ListRoles'
      ],
      Resource: '*'
    },
    {
      Effect: 'Allow',
      Action: [
        'iam:CreateRole',
        'iam:PutRolePolicy',
        'iam:PassRole'
      ],
      Resource: [
        `arn:aws:iam::${cfg.accountId}:role/${cfg.safePkgName}-ecs-task-role`,
        `arn:aws:iam::${cfg.accountId}:role/ecsTaskExecutionRole`
      ]
    }
  ];
  let serviceStatement = [];
  if (cfg.service) {
    serviceStatement = [
      {
        Effect: 'Allow',
        Action: [
          'ecs:ListServices',
          'ecs:UpdateService',
          'ecs:CreateService',
          'ecs:RunTask',
          'ecs:RegisterTaskDefinition',
          'ecs:DeleteService',
          'ecs:StopTask',
          'ecs:DescribeTasks'
        ],
        Resource: '*'
      }];
    if (cfg.service.hostedZoneId) {
      serviceStatement.push(
        {
          Effect: 'Allow',
          Action: 'route53:ChangeResourceRecordSets',
          Resource: `arn:aws:route53:::hostedzone/${cfg.service.hostedZoneId}`
        }
      );
    }
  }
  policy.Statement = policy.Statement.concat(serviceStatement);
  console.log(JSON.stringify(policy, null, 2));
};
