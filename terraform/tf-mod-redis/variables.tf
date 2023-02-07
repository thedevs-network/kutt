variable "at_rest_encryption_enabled" {
  type        = bool
  default     = false
  description = "Enable encryption at rest"
}

variable "transit_encryption_enabled" {
  type        = bool
  default     = true
  description = <<-EOT
    Set `true` to enable encryption in transit. Forced `true` if `var.auth_token` is set.
    If this is enabled, use the [following guide](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/in-transit-encryption.html#connect-tls) to access redis.
    EOT
}

variable "family" {
  type        = string
  default     = "redis4.0"
  description = "Redis family"
}

variable "engine_version" {
  type        = string
  default     = "4.0.10"
  description = "Redis engine version"
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

variable "instance_type" {
  type        = string
  default     = "cache.t3.micro"
  description = "Elastic cache instance type"
}

variable "eks_cluster_name" {
  description = "Name of the EKS cluster(for secrets injection)"
  type        = string
  default     = "test-cluster"
}

variable "description" {
  type        = string
  default     = "replication group"
  description = "Description of elasticache replication group"
}

variable "replication_group_id" {
  type        = string
  default     = "replication-group"
  description = "Replication group ID"
}

variable "elasticache_subnet_group_name" {
  type        = string
  description = "Subnet group name for the ElastiCache instance"
  default     = "elastic"
}