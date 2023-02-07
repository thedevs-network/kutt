resource "aws_wafv2_web_acl" "acl" {
  name  = var.acl_name
  scope = "REGIONAL"

  visibility_config {
    cloudwatch_metrics_enabled = false
    metric_name                = var.acl_name
    sampled_requests_enabled   = true
  }


  default_action {
    allow {}
  }

  dynamic "rule" {
    for_each = var.aws_managed_waf_groups

    content {
      name = rule.value.name

      priority = rule.value.priority

      override_action {
        dynamic "count" {
          for_each = rule.value.override_action_to_count ? [1] : []
          content {}
        }
        dynamic "none" {
          for_each = rule.value.override_action_to_count ? [] : [1]
          content {}
        }
      }

      statement {
        managed_rule_group_statement {
          name = rule.value.name

          vendor_name = "AWS"

          dynamic "excluded_rule" {

            for_each = rule.value.excluded_rules

            content {
              name = excluded_rule.value
            }
          }
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = rule.value.name
        sampled_requests_enabled   = true
      }
    }
  }
}