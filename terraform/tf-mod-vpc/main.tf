module "vpc" {
  source           = "git@github.com:terraform-aws-modules/terraform-aws-vpc.git?ref=v3.19.0"
  name             = var.name
  cidr             = var.cidr
  azs              = var.availability_zones

  database_subnets = var.database_subnets
  database_subnet_tags  = {
    "type" = "database"
    "Name" = "database"
  }

  database_route_table_tags = {
    "type" = "database"
    "Name" = "database"
  }


  private_subnets = var.private_subnets
  private_subnet_tags = {
    "type" = "private"
    "Name" = "general_private"
  }

  private_route_table_tags = {
    "type" = "private"
    "Name" = "general_private"
  }


  public_subnets = var.public_subnets
  public_subnet_tags = {
    "type" = "public"
    "Name" = "general_public"
  }

  public_route_table_tags = {
    "type"                   = "public"
    "Name"                   = "general_public"
    "kubernetes.io/role/elb" = "1"
  }
  
  enable_nat_gateway     = var.enable_nat_gateway
  one_nat_gateway_per_az = var.one_nat_gateway_per_az
}

