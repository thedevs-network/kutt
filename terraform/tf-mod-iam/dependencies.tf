data "terraform_remote_state" "eks_remote_state" {
  backend = "s3"

  config = {
    bucket   = var.state_bucket
    key      = "kutt-${var.stage}/infrastructure/eu-central-1/tf-mod-eks/terraform.tfstate"
    region   = var.region
    role_arn = "arn:aws:iam::${var.current_account}:role/kutt-full"
  }
}