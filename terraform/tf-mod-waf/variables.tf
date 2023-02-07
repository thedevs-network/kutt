variable "stage" {
  description = "Current stage(dev/int/prod)"
  type        = string
}

variable "acl_name" {
  description = "Current stage(dev/int/prod)"
  type        = string
  default     = "kutt-acl"
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

variable "aws_managed_waf_groups" {
  description = <<-EOT
  The list of AWS managed rules.
  Attributes are:
    name: name of the rule you want to apply
    priority: the priority of the rule(increment for new rule)
    excluded_rules: the list of rules you want to exclude from the ruleSet
    override_action_to_count: should this rule us the AWS defined behaviour or override it to count
  EOT
  type = list(object({
    name                     = string
    priority                 = number
    override_action_to_count = bool
    excluded_rules           = list(string)
  }))

  default = [
    {
      name                     = "AWSManagedRulesAmazonIpReputationList"
      priority                 = 1
      override_action_to_count = false
      excluded_rules           = []
    },
    {
      name                     = "AWSManagedRulesAnonymousIpList"
      priority                 = 2
      override_action_to_count = false
      excluded_rules           = []
    },
    {
      name                     = "AWSManagedRulesCommonRuleSet"
      priority                 = 3
      override_action_to_count = false
      excluded_rules           = []
    },
    {
      name                     = "AWSManagedRulesKnownBadInputsRuleSet"
      priority                 = 4
      override_action_to_count = false
      excluded_rules           = []
    },
  ]
}
