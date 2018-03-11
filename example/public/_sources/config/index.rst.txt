Configuration
=============

.. toctree::
   :hidden:

   gitbranch
   taskrole
   taskdefinition
   targetgroup
   service

################
ecs-publish.json
################

Create an ``ecs-publish.json`` that specifies, minimally, the region to publish your docker images to, e.g.

.. code-block:: json

  {
    "region": "us-east-1"
  }


Adding additional fields to this file will enable additional features, e.g.

.. code-block:: json

  {
    "region": "us-east-1",
    "branches": { },
    "taskRole": { },
    "taskDefinitionTemplate":  { },
    "targetGroup":  { },
    "service":  { }
  }

#######
Example
#######

A complete example ``ecs-publish.json`` might look like:

.. code-block:: json

  {
    "region": "us-east-1",
    "taskRole": {
      "policyDocument": {
        "Version": "2012-10-17",
        "Statement": {
          "Effect": "Allow",
          "Action": "s3:ListBucket",
          "Resource": "arn:aws:s3:::example_bucket"
        }
      }
    },
    "taskDefinitionTemplate": {
      "executionRole": "ecsTaskExecutionRole",
      "cpu": "32",
      "memory": "128",
      "envFile": "./example.env",
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "example-log-group",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs-publish-example"
        }
      },
      "portMappings": [{
        "containerPort": 3000,
        "hostPort": 0,
        "protocol": "tcp"
      }]
    },
    "targetGroup": {
      "VpcId": "vpc-a8b4c4cf",
      "Port": 3000,
      "Protocol": "HTTP",
      "HealthCheckProtocol": "HTTP",
      "HealthCheckPort": "traffic-port",
      "HealthCheckPath": "/",
      "HealthCheckIntervalSeconds": 10,
      "HealthCheckTimeoutSeconds": 5,
      "HealthyThresholdCount": 2,
      "UnhealthyThresholdCount": 3,
      "Matcher": {
        "HttpCode": "200"
      },
      "Attributes": [{
          "Value": "false",
          "Key": "stickiness.enabled"
        },
        {
          "Value": "0",
          "Key": "deregistration_delay.timeout_seconds"
        }
      ]
    },
    "service": {
      "cluster": "spot-cluster-alpha",
      "loadBalancer": "star-cimpress-cloud",
      "listenerPorts": [80, 443],
      "hostHeader": "ecs-publish.cimpress.cloud",
      "pathPattern": "/*",
      "hostedZoneId": "ZAIBJTGVJ6VKH",
      "desiredCount": 2,
      "deploymentConfiguration": {
        "maximumPercent": 200,
        "minimumHealthyPercent": 50
      },
      "placementStrategy": [{
        "type": "spread",
        "field": "attribute:ecs.availability-zone"
      }],
      "healthCheckGracePeriodSeconds": 0
    }
  }