remote_state {
  backend = "s3"

  config = {
    encrypt                 = true
    bucket                  = "kutt-state"
    key                     = "kutt-dev/infrastructure/${path_relative_to_include()}/terraform.tfstate"
    role_arn                = "arn:aws:iam::365703723957:role/kutt-full"
    region                  = "eu-central-1"
    dynamodb_table          = "kutt-dynamodb-locks"
    disable_bucket_update   = true
  }
}
