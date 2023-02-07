variable "domain_name" {
  description = "Root level domain name"
  type        = string
  default     = "kutt-sandbox.com"
}

variable "stage" {
  description = "Current stage(dev/int/prod)"
  type        = string
}

variable "state_bucket" {
  description = "Name of S3 bucket storing terraform state"
  type        = string
  default     = "kutt-state"
}

variable "region" {
  description = "Target region"
  type        = string
  default     = "eu-central-1"
}

variable "current_account" {
  description = "ID of the target account"
  type        = string
  default     = "365703723957"
}