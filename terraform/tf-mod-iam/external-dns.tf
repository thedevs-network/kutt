resource "aws_iam_role" "external_dns" {
  name = "external-dns"

  assume_role_policy = data.aws_iam_policy_document.external_dns_assume_role_policy.json
}

data "aws_iam_policy_document" "external_dns_assume_role_policy" {
  statement {
    sid = ""

    effect = "Allow"

    principals {
      type        = "Federated"
      identifiers = [data.terraform_remote_state.eks_remote_state.outputs.oidc_provider_arn]
    }

    actions = ["sts:AssumeRoleWithWebIdentity"]
  }

  version = "2012-10-17"
}

data "aws_iam_policy_document" "external_dns_role_policy" {
  statement {
    sid       = ""
    effect    = "Allow"
    resources = ["arn:aws:route53:::hostedzone/*"]
    actions   = ["route53:ChangeResourceRecordSets"]
  }

  statement {
    sid       = ""
    effect    = "Allow"
    resources = ["*"]

    actions = [
      "route53:ListHostedZones",
      "route53:ListResourceRecordSets",
    ]
  }
}

resource "aws_iam_policy" "external_dns_role_policy" {
  name   = "external-dns"
  path   = "/"
  policy = data.aws_iam_policy_document.external_dns_role_policy.json
}

resource "aws_iam_role_policy_attachment" "external_dns_attachment" {
  role       = aws_iam_role.external_dns.name
  policy_arn = aws_iam_policy.external_dns_role_policy.arn
}
