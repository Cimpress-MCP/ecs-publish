# ecs-publish

ecs-publish is infrastructure-as-code for services running in AWS EC2 Container Service (ECS). It enables systematic build, test, and deploy of Docker-based node apps.

See full documentation at https://ecs-publish.cimpress.cloud

## Installation

```shell
npm install @cimpresscloud/ecs-publish --save-dev
```

## Usage

```shell
$ ecs-publish --help

  Usage: ecs-publish [options] [command]


  Options:

    -V, --version  output the version number
    -h, --help     output usage information


  Commands:

    validate            Validate your ecs-publish.json
    build               Step 1. Build package locally with docker
    push                Step 2. Push image to ECR
    launch              Step 3. Launch image as a service in ECS
    deploy              Steps 1, 2, and 3 in one command. Build, push, and launch
    obtain-certificate  Request an ACM certificate for your service, or display a compatible existing one
    test-launch         Launch image as a standalone task in ECS, confirm it runs for 30 seconds, then stop it
    unlaunch            Remove the service, target group, and listener rules for the current branch.
    help [cmd]          display help for [cmd]
```