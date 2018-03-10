'use strict';
const ECS = require('aws-sdk/clients/ecs'),
  envfile = require('envfile'),
  logger = require('./logger');

function sleep (ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function paginateServices (region, params, serviceArns = []) {
  const ecs = new ECS({ region: region });
  params.maxResults = 10;
  return ecs.listServices(params).promise()
    .then((data) => {
      serviceArns = serviceArns.concat(data.serviceArns);
      if (data.nextToken) {
        params.nextToken = data.nextToken;
        return paginateServices(region, params, serviceArns);
      }
      return serviceArns;
    })
    .catch((err) => {
      console.error(err);
      throw new Error('Unable to list services');
    });
}

function checkIfServiceExists ({cfg}) {
  logger.action(`Checking if service ${cfg.fullName} already exists...`);
  return paginateServices(cfg.region, { cluster: cfg.service.cluster })
    .then((serviceArns) => {
      const existingServiceArns = serviceArns.filter((arn) => { return arn.indexOf(`:service/${cfg.fullName}`) >= 0; });
      if (existingServiceArns.length === 1) {
        cfg.serviceArn = existingServiceArns[0];
        logger.result(`${cfg.serviceArn}`);
        return {cfg, status: 'EXISTS'};
      }
      logger.result(`Does not exist.`);
      return {cfg, status: 'DOESNOTEXIST'};
    });
}

module.exports.registerTaskDefinition = function ({cfg}) {
  logger.action('Registering task definition...');
  const ecs = new ECS({ region: cfg.region });
  const template = cfg.taskDefinitionTemplate || {},
    envVars = (template.envFile) ? envfile.parseFileSync(template.envFile) : [];
  let environment = [];
  for (var key in envVars) {
    if (envVars.hasOwnProperty(key)) {
      environment.push({ name: key, value: envVars[key] });
    }
  }
  if (cfg.branches && cfg.branchName) {
    const matchingBranches = cfg.branches.filter((branch) => {
      const m = cfg.branchName.match(branch.pattern);
      return (m && m.length > 0);
    });
    if (matchingBranches && matchingBranches.length > 0) {
      environment.push({ name: 'NODE_ENV', value: matchingBranches[0].NODE_ENV });
    }
  }
  environment.push({ name: 'AWS_REGION', value: cfg.region });
  const params = {
    family: cfg.fullName,
    taskRoleArn: (cfg.taskRoleArn) ? cfg.taskRoleArn : cfg.taskRoleArn || '',
    cpu: (cfg.service && cfg.service.networkConfiguration) ? template.cpu : null,
    memory: (cfg.service && cfg.service.networkConfiguration) ? template.memory : null,
    containerDefinitions: [
      {
        name: cfg.fullName,
        image: cfg.tag,
        essential: true,
        cpu: template.cpu || '0',
        memory: template.memory || '0',
        disableNetworking: template.disableNetworking || null,
        environment,
        logConfiguration: template.logConfiguration || {},
        mountPoints: template.mountPoints || [],
        portMappings: template.portMappings || [],
        privileged: template.privileged || null,
        readonlyRootFilesystem: template.readonlyRootFilesystem || null,
        ulimits: template.ulimits || null,
        volumesFrom: template.volumesFrom || []
      }
    ],
    networkMode: (cfg.service && cfg.service.networkConfiguration) ? 'awsvpc' : template.networkMode || null,
    placementConstraints: template.placementConstraints || [],
    requiresCompatibilities: (cfg.service && cfg.service.networkConfiguration) ? ['FARGATE'] : ['EC2'],
    executionRoleArn: cfg.executionRoleArn || null,
    volumes: template.volumes || []
  };
  return ecs.registerTaskDefinition(params).promise()
    .then((data) => {
      cfg.taskDefinitionArn = data.taskDefinition.taskDefinitionArn;
      logger.result(`${cfg.taskDefinitionArn}`);
      return {cfg};
    });
};

module.exports.ensureServiceExists = function ({cfg}) {
  return checkIfServiceExists({cfg})
    .then(({cfg, status}) => {
      if (status === 'EXISTS') {
        return {cfg, status: 'EXISTS'};
      }
      const ecs = new ECS({ region: cfg.region });
      logger.action('Creating service...');
      const svc = cfg.service,
        deploymentConfiguration = svc.deploymentConfiguration || {
          maximumPercent: 200,
          minimumHealthyPercent: 100
        };
      const containerPort = (cfg.taskDefinitionTemplate.portMappings &&
        cfg.taskDefinitionTemplate.portMappings[0] &&
        cfg.taskDefinitionTemplate.portMappings[0].containerPort)
          ? cfg.taskDefinitionTemplate.portMappings[0].containerPort
          : 0,
        placementConstraints = svc.placementConstraints || [];
      const loadBalancers = (cfg.service.loadBalancer)
        ? [{
          containerName: cfg.fullName,
          containerPort,
          targetGroupArn: cfg.targetGroupArn
        }]
        : null;
      let params = {
        cluster: svc.cluster,
        desiredCount: svc.desiredCount || 1,
        serviceName: cfg.fullName,
        taskDefinition: cfg.taskDefinitionArn,
        deploymentConfiguration,
        platformVersion: svc.platformVersion || null,
        launchType: (!svc.networkConfiguration) ? 'EC2' : 'FARGATE',
        loadBalancers,
        placementConstraints
      };
      if (!svc.networkConfiguration) {
        params.role = svc.role || null;
        params.placementStrategy = svc.placementStrategy || [{ type: 'spread', field: 'attribute:ecs.availability-zone' }];
      } else {
        params.networkConfiguration = svc.networkConfiguration;
      };
      if (svc.loadBalancer) {
        params.healthCheckGracePeriodSeconds = svc.healthCheckGracePeriodSeconds || 0;
      }
      return ecs.createService(params).promise()
        .then((data) => {
          cfg.serviceArn = data.service.serviceArn;
          logger.result(`${cfg.serviceArn}`);
          return {cfg, status: 'CREATED'};
        });
    });
};

module.exports.ensureServiceIsUpToDate = function ({cfg, status}) {
  if (status === 'CREATED') return {cfg};
  logger.action(`Ensuring service is up to date...`);
  const ecs = new ECS({ region: cfg.region });
  const svc = cfg.service;
  const deploymentConfiguration = svc.deploymentConfiguration || {
    maximumPercent: 200,
    minimumHealthyPercent: 100
  };
  let params = {
    service: cfg.fullName,
    cluster: svc.cluster,
    deploymentConfiguration,
    desiredCount: svc.desiredCount || 1,
    forceNewDeployment: true,
    platformVersion: svc.platformVersion || null,
    taskDefinition: cfg.taskDefinitionArn
  };
  if (svc.networkConfiguration) {
    params.networkConfiguration = svc.networkConfiguration;
  }
  if (svc.loadBalancer) {
    params.healthCheckGracePeriodSeconds = svc.healthCheckGracePeriodSeconds || 0;
  }
  return ecs.updateService(params).promise()
    .then((data) => {
      logger.result(`Done`);
      return {cfg};
    });
};

module.exports.drainAndDeleteService = function ({cfg}) {
  if (!cfg.service) return {cfg};
  return checkIfServiceExists({cfg})
    .then(({cfg, status}) => {
      if (status !== 'EXISTS') return {cfg, status};
      logger.action(`Draining service...`);
      const ecs = new ECS({ region: cfg.region });
      let params = {
        service: cfg.fullName,
        cluster: cfg.service.cluster,
        desiredCount: 0,
        forceNewDeployment: true
      };
      return ecs.updateService(params).promise()
        .then((data) => {
          logger.result(`Done`);
          return {cfg, status};
        });
    })
    .then(({cfg, status}) => {
      if (status !== 'EXISTS') return {cfg};
      logger.action(`Deleting service...`);
      const ecs = new ECS({ region: cfg.region });
      let params = {
        service: cfg.fullName,
        cluster: cfg.service.cluster
      };
      return ecs.deleteService(params).promise()
        .then((data) => {
          logger.result(`Done`);
          return {cfg};
        });
    });
};

module.exports.runStandaloneTask = function ({cfg}) {
  logger.action('Running standalone test task...');
  const ecs = new ECS({ region: cfg.region });
  const svc = cfg.service;
  return ecs.runTask({ cluster: svc.cluster, taskDefinition: cfg.taskDefinitionArn }).promise()
    .then((data) => {
      cfg.testTaskArn = data.tasks[0].taskArn;
      logger.result(cfg.testTaskArn);
      return {cfg};
    });
};

module.exports.verifyStandaloneTaskIsHealthy = async function ({cfg}) {
  logger.action('Waiting 30 seconds to ensure the test task stays up...');
  await sleep(30000);
  const ecs = new ECS({ region: cfg.region });
  const svc = cfg.service;
  return ecs.describeTasks({ cluster: svc.cluster, tasks: [ cfg.testTaskArn ] }).promise()
    .then((data) => {
      if (data.tasks.length !== 1) throw new Error('Test task not found.');
      if (data.tasks[0].lastStatus !== 'RUNNING') throw new Error('Test task not running.');
      logger.result(data.tasks[0].lastStatus);
      return {cfg};
    });
};

module.exports.stopStandaloneTask = function ({cfg}) {
  logger.action('Stopping test task...');
  const ecs = new ECS({ region: cfg.region });
  const svc = cfg.service;
  return ecs.stopTask({ cluster: svc.cluster, task: cfg.testTaskArn }).promise()
    .then(async (data) => {
      logger.result('Stop command issued.');
      logger.action('Waiting 30 seconds to ensure the test task comes down...');
      await sleep(30000);
      const ecs = new ECS({ region: cfg.region });
      return ecs.describeTasks({ cluster: cfg.service.cluster, tasks: [ cfg.testTaskArn ] }).promise();
    })
    .then((data) => {
      if (data.tasks.length !== 1) throw new Error('Test task not found.');
      if (data.tasks[0].lastStatus !== 'STOPPED') throw new Error('Test task not stopped.');
      logger.result(data.tasks[0].lastStatus);
      return {cfg};
    });
};
