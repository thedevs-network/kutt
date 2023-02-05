# Underlying infrastructure

## Requirements

### AWS account

In order to allow your provisioning of infrastructure components either locally or in any sort of automation(Gitlab pipeline, Github actions, etc) the following components must be created in the chosen account upfornt:

- IAM role `kutt-ful` with full permissions within the account, permissions policy looks like the following
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "*",
            "Resource": "*"
        }
    ]
}
```
Trust relationships policy of this role must allow the identity you will use to connect to the account.

- S3 bucket(for example `kutt-state` but since bucket name must be globally uniq you need to use another name) to store terraform state
- DynamoDB table `kutt-dynamodb-locks` to store terraform locks 

### Tools

There are few CLI tools you need to install on your local environment:
- terraform & terragrunt

## VPC

We decided to split the VPC CIDR into 3 subnets:
- public - for instances & LB that must be publicly available(for example ALB pointing to EKS). The default route(0.0.0.0/0) directs to IGW.
- private - for everything that must be private, for example all worker nodes. The default route directs to NAT GW.
- database - specific subnet for database instances. Used for isolation between general private instances and DBs. The default route goes to NAT GW.

The second decision has been made is to use /21 subnets per VPC with the following further division:
- /25 is used for private subnets. This is the biggest subnet of a VPC since it's expected to use for workers/pods
- /26 is used for public subnets. This subnet is smaller since number of public instances is limited to only endpoints of loadbalancers & NAT GW
- /27 is used for databases. We don't expect many database instances.
All the above have a room for further grow and expansion.



 