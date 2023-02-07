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
    random = {
      version = "~> 3.0"
      source  = "hashicorp/random"
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
  host                   = data.terraform_remote_state.eks_remote_state.outputs.cluster_endpoint
  cluster_ca_certificate = base64decode(data.terraform_remote_state.eks_remote_state.outputs.cluster_certificate_authority_data)
  token                  = data.aws_eks_cluster_auth.kubernetes_token.token
}
