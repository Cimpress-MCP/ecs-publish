Task Role
=========

If your task requires an IAM role, the ``taskRole`` field must be used to specify an existing IAM role, or to create a new role for your task.

To specify an existing role, define only the ``roleArn`` field, e.g.

.. code-block:: json

  {
    "taskRole": {
      "roleArn": "arn:aws:iam::123456789010:role/my-existing-ecs-task-role"
    }
  }


To create a new role named after your package (i.e. ``packagename-ecs-task-role``), define the ``policyDocument`` field instead, in `AWS-compliant format <https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html>`_ e.g.

.. code-block:: json

  {
    "taskRole": {
      "policyDocument": {
        "Version": "2012-10-17",
        "Statement": {
          "Effect": "Allow",
          "Action": "s3:ListBucket",
          "Resource": "arn:aws:s3:::example_bucket"
        }
      }
    }
  }