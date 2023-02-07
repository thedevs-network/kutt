variable "cluster_name" {
  description = "The name of the RDS instance"
  type        = string
  default     = "kutt-cluster"
}

variable "engine" {
  description = "The database engine to use"
  type        = string
  default     = "aurora-postgresql"
}

variable "engine_version" {
  description = "The engine version to use"
  type        = string
  default     = "14.4"
}

variable "db_cluster_parameter_group_family" {
  description = "The family of the DB cluster parameter group"
  type        = string
  default     = "aurora-postgresql14"
}

variable "db_parameter_group_family" {
  description = "The family of the DB cluster parameter group"
  type        = string
  default     = "aurora-postgresql14"
}

variable "port" {
  description = "The port on which the DB accepts connections"
  type        = string
  default     = "5432"
}

variable "multi_az" {
  description = "Specifies if the RDS instance is multi-AZ"
  type        = bool
  default     = true
}

variable "eks_cluster_name" {
  description = "Name of the EKS cluster(for secrets injection)"
  type        = string
  default     = "test-cluster"
}

variable "stage" {
  description = "Current stage(dev/int/prod)"
  type        = string
}

variable "master_username" {
  description = "set a master username"
  type        = string
  default     = "root"
}

variable "database_name" {
  description = "The DB name to create"
  type        = string
  default     = "kutt"
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