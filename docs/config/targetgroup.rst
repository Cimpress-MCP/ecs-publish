Target Group
============

If your task requires a target group, the ``targetGroup`` field must be used to create a new target group named after your package and branch (i.e. ``packagename-branch``).

For reference, see the `CreateTargetGroup API Reference <https://docs.aws.amazon.com/elasticloadbalancing/latest/APIReference/API_CreateTargetGroup.html>`_.

.. code-block:: json

  {
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
      "Attributes": [
        {
          "Value": "false",
          "Key": "stickiness.enabled"
        },
        {
          "Value": "0",
          "Key": "deregistration_delay.timeout_seconds"
        }
      ]
    }
  }