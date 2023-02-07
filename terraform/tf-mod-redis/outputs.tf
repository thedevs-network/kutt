output "endpoint" {
  value       = module.redis.endpoint
  description = "Redis primary or configuration endpoint, whichever is appropriate for the given cluster mode"
}