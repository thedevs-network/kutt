variable "stage" {
  description = "Current stage(dev/int/prod)"
  type        = string
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

variable "repository_name" {
  description = "Name of repo"
  type        = string
  default     = "kutt-sandbox"
}
