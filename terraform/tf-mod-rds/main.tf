module "postgres" {
  source = "git@github.com:terraform-aws-modules/terraform-aws-rds-aurora.git?ref=v7.6.0"

  name    = var.cluster_name
  subnets = data.terraform_remote_state.vpc_remote_state.outputs.database_subnets

  instances = {
    1 = {
      instance_class = "db.t3.medium"
    }
    2 = {
      instance_class = "db.t3.medium"
    }
    3 = {
      instance_class = "db.t3.medium"
    }
  }

  engine                 = var.engine
  engine_version         = var.engine_version
  create_security_group  = false
  vpc_security_group_ids = [module.security_group.security_group_id]

  create_db_subnet_group = false
  db_subnet_group_name   = data.terraform_remote_state.vpc_remote_state.outputs.database_subnet_group

  create_db_cluster_parameter_group = true
  db_cluster_parameter_group_name   = "aurora-${var.cluster_name}-postgres-${replace(var.engine_version, ".", "-")}"
  db_cluster_parameter_group_family = var.db_cluster_parameter_group_family

  create_db_parameter_group = true
  db_parameter_group_name   = "aurora-${var.cluster_name}-postgres-${replace(var.engine_version, ".", "-")}"
  db_parameter_group_family = var.db_parameter_group_family

  enabled_cloudwatch_logs_exports = ["postgresql"]

  master_username = var.master_username
  database_name   = var.database_name
  port            = var.port

  auto_minor_version_upgrade = true
  apply_immediately          = true
}

module "security_group" {
  source = "git@github.com:terraform-aws-modules/terraform-aws-security-group.git?ref=v4.17.0"

  name        = var.cluster_name
  description = "Security group to allow internal traffic to AWS RDS"
  vpc_id      = data.terraform_remote_state.vpc_remote_state.outputs.vpc_id

  ingress_with_cidr_blocks = [
    {
      from_port   = var.port
      to_port     = var.port
      protocol    = "tcp"
      description = "PostgreSQL access from within VPC"
      cidr_blocks = data.terraform_remote_state.vpc_remote_state.outputs.vpc_cidr_block
    },
  ]

  egress_with_cidr_blocks = [
    {
      to_port     = 0
      protocol    = "-1"
      from_port   = 0
      cidr_blocks = "0.0.0.0/0"
    },
  ]
}

resource "kubernetes_config_map" "db-config-map" {
  metadata {
    name = "aws-${var.engine}-${var.cluster_name}"
  }

  data = {
    DB_HOST = module.postgres.cluster_endpoint
    DB_NAME = var.database_name
    DB_PORT = var.port
  }
}

resource "kubernetes_secret" "db-secret" {
  metadata {
    name = "aws-${var.engine}-${var.cluster_name}"
  }

  data = {
    DB_PASSWORD = module.postgres.cluster_master_password
    DB_USER     = var.master_username
  }
}
