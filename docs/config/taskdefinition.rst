Task Definition Template
========================

If you'd like ecs-publish to create a task definition for you, you must define ``taskDefinitionTemplate`` that will be used to register new task defintions whenever launching your application.

The task definition template will generate single-container task, and uses a simplified format that includes partial coverage of the standard task definition configuration.

For reference, see the `RegisterTaskDefinition API Reference <https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_RegisterTaskDefinition.html>`_.

.. code-block:: json

  {
    "taskDefinitionTemplate": {
      "cpu": 64,
      "memory": 128,
      "envFile": "./example.env",
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "example-log-group",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs-publish-example"
        }
      },
      "portMappings": [
        {
          "containerPort": 3000,
          "hostPort": 0,
          "protocol": "tcp"
        }
      ]
    }
  }

If you specify ``awslogs`` as the ``logConfiguration.logDriver``, ecs-publish will append the current git branch to the ``awslogs-stream-prefix`` that you specify, e.g. ``ecs-publish-example-master``

If using AWS FarGate, you must also define the ``taskDefinitionTemplate.executionRole`` field, e.g.

.. code-block:: json

  {
    "taskDefinitionTemplate": {
      "executionRole": "ecsTaskExecutionRole"
    }
  }
