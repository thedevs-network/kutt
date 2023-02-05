terraform {
  backend "s3" {
  }

  required_providers {
    aws      = ">= 4.0"
  }

  required_version = ">= 1.0"
}

provider "aws" {
  region = var.region

  assume_role {
    role_arn = "arn:aws:iam::${var.current_account}:role/kutt-full"
  }
}
