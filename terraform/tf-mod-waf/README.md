<!-- BEGINNING OF PRE-COMMIT-TERRAFORM DOCS HOOK -->
## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_stage"></a> [stage](#input\_stage) | Current stage(dev/int/prod) | `string` | n/a | yes |
| <a name="input_acl_name"></a> [acl\_name](#input\_acl\_name) | Current stage(dev/int/prod) | `string` | `"kutt-acl"` | no |
| <a name="input_aws_managed_waf_groups"></a> [aws\_managed\_waf\_groups](#input\_aws\_managed\_waf\_groups) | The list of AWS managed rules.<br>Attributes are:<br>  name: name of the rule you want to apply<br>  priority: the priority of the rule(increment for new rule)<br>  excluded\_rules: the list of rules you want to exclude from the ruleSet<br>  override\_action\_to\_count: should this rule us the AWS defined behaviour or override it to count | <pre>list(object({<br>    name                     = string<br>    priority                 = number<br>    override_action_to_count = bool<br>    excluded_rules           = list(string)<br>  }))</pre> | <pre>[<br>  {<br>    "excluded_rules": [],<br>    "name": "AWSManagedRulesAmazonIpReputationList",<br>    "override_action_to_count": false,<br>    "priority": 1<br>  },<br>  {<br>    "excluded_rules": [],<br>    "name": "AWSManagedRulesAnonymousIpList",<br>    "override_action_to_count": false,<br>    "priority": 2<br>  },<br>  {<br>    "excluded_rules": [],<br>    "name": "AWSManagedRulesCommonRuleSet",<br>    "override_action_to_count": false,<br>    "priority": 3<br>  },<br>  {<br>    "excluded_rules": [],<br>    "name": "AWSManagedRulesKnownBadInputsRuleSet",<br>    "override_action_to_count": false,<br>    "priority": 4<br>  }<br>]</pre> | no |
| <a name="input_current_account"></a> [current\_account](#input\_current\_account) | ID of the target account | `string` | `"365703723957"` | no |
| <a name="input_region"></a> [region](#input\_region) | Target region | `string` | `"eu-central-1"` | no |
| <a name="input_state_bucket"></a> [state\_bucket](#input\_state\_bucket) | Name of S3 bucket storing terraform state | `string` | `"kutt-state"` | no |

## Outputs

| Name | Description |
|------|-------------|
| <a name="output_waf_arn"></a> [waf\_arn](#output\_waf\_arn) | The Amazon Resource Name (ARN) of the WAF ACL |
<!-- END OF PRE-COMMIT-TERRAFORM DOCS HOOK -->