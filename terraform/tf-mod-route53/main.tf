locals {
  domain_validation_options = {
    for dvo in aws_acm_certificate.kutt.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  validation_domain = trimprefix(var.domain_name, ".")
}

resource "aws_route53_zone" "kutt" {
  name = var.domain_name

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_acm_certificate" "kutt" {
  domain_name               = var.domain_name
  validation_method         = "DNS"
  subject_alternative_names = ["*.${var.domain_name}"]

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_acm_certificate_validation" "kutt" {
  certificate_arn         = aws_acm_certificate.kutt.arn
  validation_record_fqdns = [aws_route53_record.kutt_validation.fqdn]
}

resource "aws_route53_record" "kutt_validation" {
  name    = local.domain_validation_options[local.validation_domain].name
  type    = local.domain_validation_options[local.validation_domain].type
  zone_id = aws_route53_zone.kutt.zone_id
  records = [local.domain_validation_options[local.validation_domain].record]
  ttl     = 60
}