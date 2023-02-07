module "ecr" {
  source                   = "git@github.com:terraform-aws-modules/terraform-aws-ecr.git?ref=v1.5.1"
  
  repository_name          = var.repository_name
  attach_repository_policy = false
  create_lifecycle_policy  = true

  repository_lifecycle_policy = jsonencode({
    rules = [
      {
        rulePriority = 1,
        description  = "Keep last 30 images",
        selection = {
          tagStatus   = "any",
          countType   = "imageCountMoreThan",
          countNumber = 10
        },
        action = {
          type = "expire"
        }
      }
    ]
  })

  repository_force_delete = true
}