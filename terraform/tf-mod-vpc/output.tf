output "vpc_id" {
  value       = module.vpc.vpc_id
  description = "The ID of VPC"
}

output "public_subnets" {
  value       = module.vpc.public_subnets
  description = "List of IDs for public subnets(3 subnets - one per AZ)"
}

output "private_subnets" {
  value       = module.vpc.private_subnets
  description = "List of IDs for private subnets(3 subnets - one per AZ)"
}

output "database_subnets" {
  value       = module.vpc.database_subnets
  description = "List of IDs for database subnets(3 subnets - one per AZ)"
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnets_cidr_blocks" {
  description = "List of cidr_blocks of private subnets"
  value       = module.vpc.private_subnets_cidr_blocks
}

output "public_subnets_cidr_blocks" {
  description = "List of cidr_blocks of public subnets"
  value       = module.vpc.public_subnets_cidr_blocks
}

output "azs" {
  description = "A list of availability zones specified as argument to this module"
  value       = module.vpc.azs
}

output "database_subnet_group" {
  description = "ID of database subnet group"
  value       = module.vpc.database_subnet_group
}
