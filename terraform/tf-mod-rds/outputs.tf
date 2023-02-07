output "cluster_endpoint" {
  description = "Writer endpoint for the cluster"
  value       = module.postgres.cluster_endpoint
}

output "cluster_reader_endpoint" {
  description = "A read-only endpoint for the cluster, automatically load-balanced across replicas"
  value       = module.postgres.cluster_reader_endpoint
}