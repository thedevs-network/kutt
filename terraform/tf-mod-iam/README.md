<!-- BEGINNING OF PRE-COMMIT-TERRAFORM DOCS HOOK -->
## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_stage"></a> [stage](#input\_stage) | Current stage(dev/int/prod) | `string` | n/a | yes |
| <a name="input_current_account"></a> [current\_account](#input\_current\_account) | ID of the target account | `string` | `"365703723957"` | no |
| <a name="input_eks_cluster_name"></a> [eks\_cluster\_name](#input\_eks\_cluster\_name) | Name of the EKS cluster(for secrets injection) | `string` | `"test-cluster"` | no |
| <a name="input_region"></a> [region](#input\_region) | Target region | `string` | `"eu-central-1"` | no |
| <a name="input_state_bucket"></a> [state\_bucket](#input\_state\_bucket) | Name of S3 bucket storing terraform state | `string` | `"kutt-state"` | no |

## Outputs

No outputs.
<!-- END OF PRE-COMMIT-TERRAFORM DOCS HOOK -->