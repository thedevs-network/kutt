{{/*
Define deployment strategy type
*/}}
{{- define "base-chart.deploymentStrategy" -}}
{{- if eq .Values.deployment.strategy.type "Recreate" }}
type: Recreate
{{- else -}}
{{- toYaml .Values.deployment.strategy | nindent 4 -}}
{{- end -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "base-chart.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "base-chart.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "base-chart.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Define sealed secrets scope annotations
See: https://github.com/bitnami-labs/sealed-secrets#scopes
*/}}
{{- define "base-chart.sealedSecretsScopeAnnotations" -}}
{{- if eq .Values.sealedSecrets.scope "cluster-wide" }}
sealedsecrets.bitnami.com/cluster-wide: "true"
{{- else if eq .Values.sealedSecrets.scope "namespace-wide" }}
sealedsecrets.bitnami.com/namespace-wide: "true"
{{- else }}
sealedsecrets.bitnami.com/strict: "true"
{{- end }}
{{- end -}}
