Service
=======

If you'd like to run your task as a service, the ``service`` field in ``ecs-publish.json`` must be defined. For reference, see the `CreateService API Reference <https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_CreateService.html>`_.

.. code-block:: json

  {
    "service": {
      "cluster": "my-existing-ecs-cluster",
      "loadBalancer": "my-existing-application-load-balancer",
      "listenerPorts": [80, 443],
      "hostHeader": "myservice.mydomain.com",
      "pathPattern": "/*",
      "hostedZoneId": "ZAIANT5VJ6Q1P",
      "desiredCount": 2,
      "deploymentConfiguration": {
        "maximumPercent": 200,
        "minimumHealthyPercent": 50
      },
      "placementStrategy": [
        {
          "type": "spread",
          "field": "attribute:ecs.availability-zone"
        }
      ],
      "healthCheckGracePeriodSeconds": 0
    }
  }

The service will be named after your package and git branch (i.e. ``packagename-branch``).

If the ``service.hostedZoneId`` field is defined, ecs-publish will create a Route 53 resource record set in the specified zone named according to the ``service.hostHeader`` field you set.

If the branch being deployed is something other than your default branch, ecs-publish will instead create a resource record set with the branch name as a subdomain of the package name (i.e. ``branch.hostHeader``).

If using AWS FarGate, you must also define the ``service.networkConfiguration`` field, e.g.

.. code-block:: json

  {
    "service": {
      "networkConfiguration": {
        "awsvpcConfiguration": {
          "subnets": [
            "subnet-1a2b3c4d"
          ],
          "assignPublicIp": "DISABLED",
          "securityGroups": [
            "sg-5e6f7a8b"
          ]
        }
      }
    }
  }
