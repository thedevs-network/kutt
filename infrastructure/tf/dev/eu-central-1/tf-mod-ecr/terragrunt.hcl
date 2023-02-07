terraform {
  source = "../../../../../terraform/tf-mod-ecr/"

  extra_arguments "custom_vars" {
    commands = get_terraform_commands_that_need_vars()


    required_var_files = [
      "${get_terragrunt_dir()}/../../common.tfvars",
      "${get_terragrunt_dir()}/../region.tfvars"
    ]
  }
}

include  {
  path = "${find_in_parent_folders()}"
}
