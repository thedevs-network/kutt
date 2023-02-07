module "eks" {
  source                         = "git@github.com:terraform-aws-modules/terraform-aws-eks.git?ref=v19.6.0"

  cluster_name                   = var.cluster_name
  cluster_version                = var.cluster_version
  cluster_endpoint_public_access = true

  cluster_addons = {
    kube-proxy = {}
    vpc-cni    = {}
    coredns = {
      configuration_values = jsonencode({
        computeType = "Fargate"
      })
    }
  }

  vpc_id                        = data.terraform_remote_state.vpc_remote_state.outputs.vpc_id
  subnet_ids                    = data.terraform_remote_state.vpc_remote_state.outputs.private_subnets
  control_plane_subnet_ids      = data.terraform_remote_state.vpc_remote_state.outputs.public_subnets

  create_cluster_security_group = false
  create_node_security_group    = false

  fargate_profile_defaults = {
    iam_role_additional_policies = {
      additional = aws_iam_policy.additional.arn
    }
  }

  fargate_profiles = merge(
    {
      default = {
        name = "default"
        selectors = [
          {
            namespace = "default"
          },
        ]
      }
    },
    {
      kube-system = {
        name = "kube-system"
        selectors = [
          {
            namespace = "kube-system"
          },
        ]
      }
    },
    {
      logging = {
        name = "logging"
        selectors = [
          {
            namespace = "logging"
          },
        ]
      }
    },
    {
      external-dns = {
        name = "external-dns"
        selectors = [
          {
            namespace = "external-dns"
          },
        ]
      }
    },
    {
      load-balancer = {
        name = "load-balancer"
        selectors = [
          {
            namespace = "load-balancer"
          },
        ]
      }
    },
    {
      sealed-secrets = {
        name = "sealed-secrets"
        selectors = [
          {
            namespace = "sealed-secrets"
          },
        ]
      }
    },
  )

  create_aws_auth_configmap = true
  
  aws_auth_roles = [
    {
      rolearn  = "arn:aws:iam::${var.current_account}:role/${var.admin_role}"
      username = "admin"
      groups   = ["cluster-admin"]
    },
  ]
}

resource "aws_iam_policy" "additional" {
  name = "${var.cluster_name}-additional"
  policy = data.aws_iam_policy_document.additional.json
}

data "aws_iam_policy_document" "additional" {
  statement {
    sid       = ""
    effect    = "Allow"
    resources = ["*"]
    actions   = ["ecr:*"]
  }
}