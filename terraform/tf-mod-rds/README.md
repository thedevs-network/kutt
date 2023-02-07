<!-- BEGINNING OF PRE-COMMIT-TERRAFORM DOCS HOOK -->
## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_stage"></a> [stage](#input\_stage) | Current stage(dev/int/prod) | `string` | n/a | yes |
| <a name="input_cluster_name"></a> [cluster\_name](#input\_cluster\_name) | The name of the RDS instance | `string` | `"kutt-cluster"` | no |
| <a name="input_current_account"></a> [current\_account](#input\_current\_account) | ID of the target account | `string` | `"365703723957"` | no |
| <a name="input_database_name"></a> [database\_name](#input\_database\_name) | The DB name to create | `string` | `"kutt"` | no |
| <a name="input_db_cluster_parameter_group_family"></a> [db\_cluster\_parameter\_group\_family](#input\_db\_cluster\_parameter\_group\_family) | The family of the DB cluster parameter group | `string` | `"aurora-postgresql14"` | no |
| <a name="input_db_parameter_group_family"></a> [db\_parameter\_group\_family](#input\_db\_parameter\_group\_family) | The family of the DB cluster parameter group | `string` | `"aurora-postgresql14"` | no |
| <a name="input_eks_cluster_name"></a> [eks\_cluster\_name](#input\_eks\_cluster\_name) | Name of the EKS cluster(for secrets injection) | `string` | `"test-cluster"` | no |
| <a name="input_engine"></a> [engine](#input\_engine) | The database engine to use | `string` | `"aurora-postgresql"` | no |
| <a name="input_engine_version"></a> [engine\_version](#input\_engine\_version) | The engine version to use | `string` | `"14.4"` | no |
| <a name="input_master_username"></a> [master\_username](#input\_master\_username) | set a master username | `string` | `"root"` | no |
| <a name="input_multi_az"></a> [multi\_az](#input\_multi\_az) | Specifies if the RDS instance is multi-AZ | `bool` | `true` | no |
| <a name="input_port"></a> [port](#input\_port) | The port on which the DB accepts connections | `string` | `"5432"` | no |
| <a name="input_region"></a> [region](#input\_region) | Target region | `string` | `"eu-central-1"` | no |
| <a name="input_state_bucket"></a> [state\_bucket](#input\_state\_bucket) | Name of S3 bucket storing terraform state | `string` | `"kutt-state"` | no |

## Outputs

| Name | Description |
|------|-------------|
| <a name="output_cluster_endpoint"></a> [cluster\_endpoint](#output\_cluster\_endpoint) | Writer endpoint for the cluster |
| <a name="output_cluster_reader_endpoint"></a> [cluster\_reader\_endpoint](#output\_cluster\_reader\_endpoint) | A read-only endpoint for the cluster, automatically load-balanced across replicas |
<!-- END OF PRE-COMMIT-TERRAFORM DOCS HOOK -->