Installation
============

#############
Prerequisites
#############

* An existing node project, with Dockerfile, using git
* For running your tasks, an existing `AWS ECS Cluster <https://docs.aws.amazon.com/AmazonECS/latest/developerguide/create_cluster.html>`_
* For running web services, an existing `Application Load Balancer <https://docs.aws.amazon.com/AmazonECS/latest/developerguide/create-application-load-balancer.html>`_
* For creating/updating DNS, an existing `Route 53 Hosted Zone <https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/CreatingHostedZone.html>`_
* For performing deployments, `AWS credentials <https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CredentialProviderChain.html>`_, i.e.

  * `EnvironmentCredentials <https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EnvironmentCredentials.html>`_, or
  * `SharedIniFileCredentials <https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SharedIniFileCredentials.html>`_, or
  * `EC2MetadataCredentials <https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2MetadataCredentials.html>`_

#######
Install
#######

.. code-block:: shell

  npm install @cimpresscloud/ecs-publish --save-dev