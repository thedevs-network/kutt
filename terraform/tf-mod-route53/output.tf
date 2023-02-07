output "hosted_zone_id" {
  value       = aws_route53_zone.kutt.id
  description = "ID of created hosted zone"
}