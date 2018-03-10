ecs-publish
===========

.. toctree::
   :hidden:

   install
   config/index
   usage/index

ecs-publish is infrastructure-as-code for services running in AWS EC2 Container Service (ECS). It enables systematic build, test, and deploy of Docker-based node apps.

ecs-publish will:

* build and tag a docker image using the version in your project's `package.json`
* login to your ECR registry and push the image to an ECS repository, creating the repository if needed

*(optionally)*:

* create an IAM role for your ECS task (or use an existing role)
* register a Task Definition that uses your image in EC2 or AWS FarGate
* request an ACM certificate and validate using Route 53
* create an EC2 target group named after your project and git branch (i.e. `packagename-branch`).
* add your target group to an existing Application Load Balancer (if needed)
* create a Route 53 Alias record that points to your ALB (or update an existing record)
* create an ECS service named after your project and git branch (or update an existing service)