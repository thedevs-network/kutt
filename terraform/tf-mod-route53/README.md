<!-- BEGINNING OF PRE-COMMIT-TERRAFORM DOCS HOOK -->
## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_stage"></a> [stage](#input\_stage) | Current stage(dev/int/prod) | `string` | n/a | yes |
| <a name="input_current_account"></a> [current\_account](#input\_current\_account) | ID of the target account | `string` | `"365703723957"` | no |
| <a name="input_domain_name"></a> [domain\_name](#input\_domain\_name) | Root level domain name | `string` | `"kutt-sandbox.com"` | no |
| <a name="input_region"></a> [region](#input\_region) | Target region | `string` | `"eu-central-1"` | no |
| <a name="input_state_bucket"></a> [state\_bucket](#input\_state\_bucket) | Name of S3 bucket storing terraform state | `string` | `"kutt-state"` | no |

## Outputs

| Name | Description |
|------|-------------|
| <a name="output_hosted_zone_id"></a> [hosted\_zone\_id](#output\_hosted\_zone\_id) | ID of created hosted zone |
<!-- END OF PRE-COMMIT-TERRAFORM DOCS HOOK -->