Commands
========

ecs-publish has several commands.

Glossary, for the purposes of this section:

Ensure
  ecs-publish will check to see if a resource already exists, and will create it if needed.

Confirm
  ecs-publish will check if a resource is in a particular state, and will error if it is not.

########
validate
########

Validate your ecs-publish.json

Usage: ``ecs-publish validate``

#####
build
#####

Build and tag your Docker image

Usage: ``ecs-publish build``

####
push
####

Push an image to ECR, creating the repository if needed.

Usage: ``ecs-publish push``

1. Validate AWS credentials
2. Ensure an ECR repository exists for your package
3. Confirm an image with the same tag doesn't already exist in the repository
4. Tag your image for the repository
5. Get an ECR Authorization Token
6. Login to ECR
7. Push your image to the repository

###########
test-launch
###########

Usage: ``ecs-publish test-launch``

Launch your package as a standalone task in ECS, confirm the task runs for 30 seconds, then stop the task.

1. Validate AWS credentials
2. Ensure an ECR repository exists for your package
3. Confirm an image with the correct tag already exists in the repository
4. Ensure your Task Role exists
5. Ensure your Task Role Policy is up to date
6. Register a new Task Definition
7. Run a standalone task in your ECS cluster
8. Confirm the task stays running for 30 seconds
9. Stop the standalone task

######
launch
######

Launch your package as a service in ECS, creating a target group, ALB listener rules, ECS service, and Route 53 record set.

Usage: ``ecs-publish launch``

1. Validate AWS credentials
2. Ensure an ECR repository exists for your package
3. Confirm an image with the correct tag already exists in the repository
4. Ensure your Task Role exists
5. Ensure your Task Role Policy is up to date
6. Register a new Task Definition
7. Ensure a properly named Target Group exists
8. Update Target Group Attributes
9. Confirm the Load Balancer you specified exists
10. Ensure Target Group is in the Load Balancer listener ports you specify
11. Confirm the ACM Certificate you specified has been issued
12. Ensure the ACM Certificate is in the load balancer (assumes Listener port 443)
13. Ensure a properly named ECS Service exists
14. Update the ECS Service with the current Task Definition
15. Ensure the Route 53 Resource Record is up to date

######
deploy
######

Usage: ``ecs-publish deploy``

The equivalent of:

.. code-block:: shell

  ecs-publish build
  ecs-publish push
  ecs-publish launch

########
unlaunch
########

Remove the service, target group, and listener rules for the current branch.

##################
obtain-certificate
##################

Request a certificate for your service, or display the ARN of a compatible existing certificate.

Since ecs-publish creates subdomains for non-default branch environments, the certificate it requests (and expects) must have a wildcard ``SubjectAlternativeName``.
