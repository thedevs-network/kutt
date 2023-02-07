variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
  default     = "test-cluster"
}

variable "cluster_version" {
  description = "Kubernetes `<major>.<minor>` version to use for the EKS cluster (i.e.: `1.24`)"
  type        = string
  default     = "1.24"
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

variable "stage" {
  description = "Current stage(dev/int/prod)"
  type        = string
}

variable "admin_role" {
  description = "Name of the role you use to connect to the cluster"
  type        = string
  default     = "OktaAdmin"
}

variable "availability_zones" {
  description = "A list of availability zones names or ids in the region"
  type        = list(string)
}