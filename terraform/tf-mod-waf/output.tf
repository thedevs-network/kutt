output "waf_arn" {
  description = "The Amazon Resource Name (ARN) of the WAF ACL"
  value       = aws_wafv2_web_acl.acl.arn
}