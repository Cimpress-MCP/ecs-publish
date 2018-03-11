'use strict';
const ELBv2 = require('aws-sdk/clients/elbv2'),
  logger = require('./logger');

function paginateListeners (region, params, listeners = []) {
  const elb = new ELBv2({ region: region });
  return elb.describeListeners(params).promise()
    .then((data) => {
      listeners = listeners.concat(data.Listeners);
      if (data.NextMarker) {
        params.Marker = data.NextMarker;
        return paginateListeners(region, params, listeners);
      }
      return listeners;
    })
    .catch((err) => {
      console.error(err);
      throw new Error('Unable to describe listeners');
    });
}

function checkIfTargetGroupExists ({cfg}) {
  logger.action(`Checking if target group exists...`);
  const elb = new ELBv2({ region: cfg.region });
  return elb.describeTargetGroups({ Names: [cfg.fullName] }).promise()
    .then((data) => {
      cfg.targetGroupArn = data.TargetGroups[0].TargetGroupArn;
      logger.result(`${cfg.targetGroupArn}`);
      return {cfg, status: 'EXISTS'};
    })
    .catch((err) => {
      if (err.code !== 'TargetGroupNotFound') throw err;
      logger.result('Does not exist.');
      return {cfg, status: 'DOESNOTEXIST'};
    });
}

function checkIfTargetGoupIsInLoadBalancer ({cfg}) {
  logger.action(`Checking if target group is in load balancer...`);
  const elb = new ELBv2({ region: cfg.region });
  return paginateListeners(cfg.region, { LoadBalancerArn: cfg.loadBalancerArn })
    .then((listeners) => {
      cfg.listeners = listeners;
      cfg.service.listenerPorts.forEach((port) => {
        if (cfg.listeners.filter((listener) => { return listener.Port === port; }).length !== 1) throw new Error(`Load balancer ${cfg.service.loadBalancer} is missing a listener for port ${port}`);
      });
      return Promise.all(cfg.listeners.map((listener) => {
        return elb.describeRules({ ListenerArn: listener.ListenerArn }).promise();
      }));
    })
    .then((rulePromises) => {
      return new Promise((resolve, reject) => {
        cfg.rules = [];
        rulePromises.forEach((rp, i) => {
          const rules = rp.Rules.map((rule) => {
            rule.ListenerArn = cfg.listeners[i].ListenerArn;
            return rule;
          });
          cfg.rules = cfg.rules.concat(rules);
        });
        let rules = [];
        cfg.rules.forEach((rule) => {
          const matchingActions = rule.Actions.filter((action) => {
            return action.TargetGroupArn === cfg.targetGroupArn;
          });
          let matchingConditions = [];
          rule.Conditions.forEach((condition) => {
            switch (condition.Field) {
              case 'host-header':
                if (condition.Values.indexOf(cfg.service.hostHeader) >= 0) matchingConditions.push(condition);
                break;
              case 'path-pattern':
                if (condition.Values.indexOf(cfg.service.pathPattern) >= 0) matchingConditions.push(condition);
                break;
            }
          });
          const expectedConditions = [cfg.service.hostHeader, cfg.service.pathPattern].filter((c) => { return c !== undefined; });
          if ((matchingActions.length > 0) && (matchingConditions.length === expectedConditions.length)) {
            logger.result(rule.RuleArn);
            rules.push(rule);
          }
        });
        if (rules.length > 0) return resolve({cfg, rules});
        return reject(new Error('ListenerRuleNotFoundException'));
      });
    });
}

module.exports.ensureTargetGroupExists = function ({cfg}) {
  if (!cfg.targetGroup) return {cfg};
  return checkIfTargetGroupExists({cfg})
    .then(({cfg, status}) => {
      if (status === 'EXISTS') return {cfg};
      logger.action('Creating target group...');
      const elb = new ELBv2({ region: cfg.region });
      const tg = cfg.targetGroup;
      return elb.createTargetGroup({
        Name: cfg.fullName,
        VpcId: tg.VpcId,
        Port: tg.Port,
        Protocol: tg.Protocol || 'HTTP',
        HealthCheckIntervalSeconds: tg.HealthCheckIntervalSeconds || '0',
        HealthCheckPath: tg.HealthCheckPath || '/',
        HealthCheckPort: tg.HealthCheckPort || 'traffic-port',
        HealthCheckProtocol: tg.HealthCheckProtocol || 'HTTP',
        HealthCheckTimeoutSeconds: tg.HealthCheckTimeoutSeconds || '5',
        HealthyThresholdCount: tg.HealthyThresholdCount || '2',
        UnhealthyThresholdCount: tg.UnhealthyThresholdCount || '3',
        Matcher: tg.Matcher || { HttpCode: '200' },
        TargetType: (cfg.service.networkConfiguration) ? 'ip' : 'instance'
      }).promise()
        .then((data) => {
          cfg.targetGroupArn = data.TargetGroups[0].TargetGroupArn;
          logger.result(`${cfg.targetGroupArn}`);
          return {cfg};
        });
    });
};

module.exports.updateTargetGroupAttributes = function ({cfg}) {
  if (!cfg.targetGroup || !cfg.targetGroup.Attributes) return {cfg};
  logger.action(`Updating target group attributes...`);
  const elb = new ELBv2({ region: cfg.region });
  const tg = cfg.targetGroup;
  return elb.modifyTargetGroup({
    TargetGroupArn: cfg.targetGroupArn,
    HealthCheckIntervalSeconds: tg.HealthCheckIntervalSeconds || '0',
    HealthCheckPath: tg.HealthCheckPath || '/',
    HealthCheckPort: tg.HealthCheckPort || 'traffic-port',
    HealthCheckProtocol: tg.HealthCheckProtocol || 'HTTP',
    HealthCheckTimeoutSeconds: tg.HealthCheckTimeoutSeconds || '5',
    HealthyThresholdCount: tg.HealthyThresholdCount || '2',
    UnhealthyThresholdCount: tg.UnhealthyThresholdCount || '3',
    Matcher: tg.Matcher || { HttpCode: '200' }
  }).promise()
    .then((data) => {
      return elb.modifyTargetGroupAttributes({
        TargetGroupArn: cfg.targetGroupArn,
        Attributes: cfg.targetGroup.Attributes
      }).promise()
        .then((data) => {
          logger.result(`Done`);
          return {cfg};
        });
    });
};

module.exports.ensureLoadBalancerExists = function ({cfg}) {
  if (!cfg.targetGroup || !cfg.service || !cfg.service.loadBalancer) return {cfg};
  logger.action(`Ensuring load balancer '${cfg.service.loadBalancer}' exists...`);
  const elb = new ELBv2({ region: cfg.region });
  return elb.describeLoadBalancers({ Names: [cfg.service.loadBalancer] }).promise()
    .then((data) => {
      if (data.LoadBalancers.length !== 1) throw new Error(`load balancer ${cfg.service.loadBalance} does not exist`);
      cfg.loadBalancerArn = data.LoadBalancers[0].LoadBalancerArn;
      cfg.loadBalancerDnsName = data.LoadBalancers[0].DNSName;
      logger.result(`${cfg.loadBalancerArn}`);
      return {cfg};
    });
};

module.exports.ensureTargetGroupIsInLoadBalancer = function ({cfg}) {
  if (!cfg.targetGroup || !cfg.service || !cfg.service.loadBalancer) return {cfg};
  return checkIfTargetGoupIsInLoadBalancer({cfg})
    .catch((err) => {
      if (err.message !== 'ListenerRuleNotFoundException') throw new Error(`${err.code}: ${err.message}`);
      const elb = new ELBv2({ region: cfg.region });
      logger.result('Listener rules mismatch for target group.');
      logger.action('Creating rules for each listener...');
      return Promise.all(cfg.service.listenerPorts.map((port) => {
        const listener = cfg.listeners.filter((listener) => { return listener.Port === port; })[0];
        const existingPriorities = cfg.rules.filter((rule) => { return rule.ListenerArn === listener.ListenerArn; }).map((r) => { return (r.Priority !== 'default') ? parseInt(r.Priority) : -1; });
        const params = {
          Actions: [
            {
              TargetGroupArn: cfg.targetGroupArn,
              Type: 'forward'
            }
          ],
          Conditions: [
            {
              Field: 'host-header',
              Values: [cfg.hostHeader]
            }
          ],
          ListenerArn: listener.ListenerArn,
          Priority: Math.max.apply(null, existingPriorities) + 1
        };
        if (cfg.service.pathPattern) {
          params.Conditions.push({
            Field: 'path-pattern',
            Values: [cfg.service.pathPattern]
          });
        }
        return elb.createRule(params).promise()
          .then((data) => {
            logger.result(`Port ${port}: ${data.Rules[0].RuleArn}`);
          });
      }))
        .then(() => {
          return {cfg};
        });
    });
};

module.exports.confirmTargetGroupExists = function ({cfg}) {
  return checkIfTargetGroupExists({cfg});
};

module.exports.deleteTargetGroupFromLoadBalancer = function ({cfg}) {
  if (!cfg.targetGroup || !cfg.service || !cfg.service.loadBalancer) return {cfg};
  return checkIfTargetGoupIsInLoadBalancer({cfg})
    .then(({cfg, rules}) => {
      logger.action('Deleting rules from listeners...');
      const elb = new ELBv2({ region: cfg.region });
      return Promise.all(rules.map((rule) => { return elb.deleteRule({ RuleArn: rule.RuleArn }).promise(); }))
        .then((datas) => {
          logger.result('Done');
          return {cfg};
        });
    })
    .catch((err) => {
      if (err.message !== 'ListenerRuleNotFoundException') throw new Error(`${err.code}: ${err.message}`);
      logger.result('No listener rules found for target group');
      return {cfg};
    });
};

module.exports.deleteTargetGroup = function ({cfg}) {
  if (!cfg.targetGroup) return {cfg};
  return checkIfTargetGroupExists({cfg})
    .then(({cfg, status}) => {
      if (status === 'DOESNOTEXIST') return {cfg};
      logger.action('Deleting target group...');
      const elb = new ELBv2({ region: cfg.region });
      return elb.deleteTargetGroup({ TargetGroupArn: cfg.targetGroupArn }).promise()
        .then((data) => {
          logger.result('Done');
          return {cfg};
        });
    });
};

module.exports.ensureCertificateIsInLoadBalancer = function ({cfg}) {
  if (!cfg.targetGroup || !cfg.service || !cfg.service.loadBalancer) return {cfg};
  logger.action('Ensuring certificate is in load balancer...');
  if (!cfg.certificateArn) throw new Error('Certificate not issued.');
  const httpsListeners = cfg.listeners.filter((listener) => { return listener.Port === 443; });
  if (httpsListeners.length !== 1) throw new Error('No HTTPS listener');
  const elb = new ELBv2({ region: cfg.region });
  return elb.addListenerCertificates({
    Certificates: [{ CertificateArn: cfg.certificateArn }],
    ListenerArn: httpsListeners[0].ListenerArn
  }).promise()
    .then((data) => {
      logger.result('Done');
      return {cfg};
    });
};
