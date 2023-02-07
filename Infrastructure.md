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

![High level diagram](AWS.svg)

## VPC plan
 
We decided to split the VPC CIDR into 3 subnets:
- public - for instances & LB that must be publicly available(for example ALB pointing to EKS). The default route(0.0.0.0/0) directs to IGW.
- private - for everything that must be private, for example all worker nodes. The default route directs to NAT GW.
- database - specific subnet for database instances. Used for isolation between general private instances and DBs. The default route goes to NAT GW.

The second decision has been made is to use /21 subnets per VPC with the following further division:
- /25 is used for private subnets. This is the biggest subnet of a VPC since it's expected to use for workers/pods
- /26 is used for public subnets. This subnet is smaller since number of public instances is limited to only endpoints of loadbalancers & NAT GW
- /27 is used for databases. We don't expect many database instances.
All the above have a room for further grow and expansion.

## Other services

- AWS EKS - We decided to use kubernetes as runtime for our application because currently it's de facto standard which has many features and integration. In order to relieve the burden of maintain workes we decide to go serverless(EKS fargate).
- AWS Aurora PSQ - For DB we decided to use AWS Aurora Postgres due its perfomance level and high availablity. For redundancy we deploy the DB across all AZ within the region
- AWS Elasticache Redis - to store cache of the application. We also deploy one primary node and two replicas to be fault tolerant in case of failure of AZ.
- AWS ECR - as Docker registry for our team/application
- AWS Route53 - we use this service as DNS registry for our kutt-sandbox.com domain
- AWS IAM - we need to deploy few IAM roles to allow k8s controllers communicate with our AWS account(to create new resources, modify or remove existing ones)
- AWS WAF - is used in combination with AWS ALB to protect our application from most common vulnerabilities
- AWS ACM - keeps TLS certificate for our application. Along with the certificate for root domain, we create wildcard one that can be used for any subdomain behind the root domain 

## Kubernetes

We decided to deploy the following namespaces:
- default - namespace for our application
- external-dns - namespace for external-dns controller
- load-balancer - namespace for load-balancer controller
- sealed-secrets - namespace for sealed secrets controller
- aws-observability - for the future usage, can be used by metrics/logs collector

### Load-balancer controller

This controller needs for automatically provision new NLB/ALB for our services running in the cluster. We can use different annotations to controll the LB behavior, such as we can atatch ACM certificates or WAF ACL

### External-dns controller

Is used in combination with the previous controller to update AWS Route53 hosted zone/s and add CNAME records pointing to a new load balancer endpoint

### Sealed secret controller

We need the way to store sensitive infomation. This controller encrypt/decrypt secrets allowing us to store such sensitive information in git repository

## Possible improvements

Currently, the application doesn't expose any metrics/valuable logs but we will need to have possibility to collect this information for the future analisis