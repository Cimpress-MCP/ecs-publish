Git Branch
==========

##############
Current Branch
##############

ecs-publish uses the current git branch to determine several things:

* the name of your EC2 Target Group: ``mypackage-branch``
* the name of your ECS Service: ``mypackage-branch``
* the ``awslogs-stream-prefix`` when using the **awslogs** log driver: ``prefix-branch``
* the host header when creating a Route 53 Resource Record:

  * if on the default branch: ``myhostheader.com``
  * if on any other branch:  ``branch.myhostheader.com``

Additionally, the abbreviate SHA of the current commit will be used as a suffix when tagging any images in non-default branches, e.g. ``1.0.0-b45e463bca``.

################################
Setting NODE_ENV based on branch
################################

ecs-publish can dynamically set the NODE_ENV environment variable in your task definition based on git branch pattern matching.

**master** will be considered the default branch. To override, set the ``default`` field to ``true`` for the desired branch:

.. code-block:: json

  {
    "region": "us-east-1",
    "branches": [{
      "pattern": "master",
      "NODE_ENV": "production",
      "default": true
    }, {
      "pattern": "dev",
      "NODE_ENV": "development"
    }, {
      "pattern": ".*",
      "NODE_ENV": "local"
    }]
  }