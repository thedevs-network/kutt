terraform {
  backend "s3" {
  }

  required_providers {
    aws = {
      version = ">= 4.0"
      source  = "hashicorp/aws"
    }
    kubernetes = {
      version = "~> 2.7"
      source  = "hashicorp/kubernetes"
    }
  }

  required_version = ">= 1.0"
}

provider "aws" {
  region = var.region

  assume_role {
    role_arn = "arn:aws:iam::${var.current_account}:role/kutt-full"
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  token                  = data.aws_eks_cluster_auth.kubernetes_token.token
}
