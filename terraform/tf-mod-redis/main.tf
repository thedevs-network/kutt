module "redis" {
  source = "git@github.com:cloudposse/terraform-aws-elasticache-redis.git?ref=0.49.0"

  vpc_id = data.terraform_remote_state.vpc_remote_state.outputs.vpc_id

  subnets                              = data.terraform_remote_state.vpc_remote_state.outputs.database_subnets
  instance_type                        = var.instance_type
  apply_immediately                    = true
  automatic_failover_enabled           = true
  cluster_mode_enabled                 = true
  engine_version                       = var.engine_version
  family                               = var.family
  at_rest_encryption_enabled           = var.at_rest_encryption_enabled
  transit_encryption_enabled           = var.transit_encryption_enabled
  description                          = var.description
  replication_group_id                 = var.replication_group_id
  elasticache_subnet_group_name        = var.elasticache_subnet_group_name
  auto_minor_version_upgrade           = true
  cluster_mode_num_node_groups         = 1
  multi_az_enabled                     = true
  cluster_mode_replicas_per_node_group = 2
  auth_token                           = random_string.auth_token.result
  allow_all_egress                     = true
  additional_security_group_rules      = [
    {
      type        = "ingress"
      from_port   = "6379"
      to_port     = "6379"
      protocol    = "tcp"
      description = "Redis access from within VPC"
      cidr_blocks = data.terraform_remote_state.vpc_remote_state.outputs.private_subnets_cidr_blocks
    },
  ]
  context                              = module.this.context

}

resource "random_string" "auth_token" {
  length           = 18
  special          = true
  min_lower        = 1
  min_upper        = 1
  min_special      = 1
  override_special = ".-_"

  lifecycle {
    ignore_changes = [override_special]
  }
}


resource "kubernetes_config_map" "redis-config-map" {
  metadata {
    name = "aws-redis-${var.replication_group_id}"
  }

  data = {
    REDIS_HOST     = module.redis.endpoint
    REDIS_PASSWORD = random_string.auth_token.result
  }
}