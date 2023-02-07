{{/*
Kubernetes standard labels
https://kubernetes.io/docs/concepts/overview/working-with-objects/common-labels/
*/}}
{{- define "base.labels.standard" -}}
app.kubernetes.io/name: {{ include "common.names.fullname" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{/*
Labels to use on deploy.spec.selector.matchLabels and svc.spec.selector
*/}}
{{- define "base.labels.matchLabels" -}}
app.kubernetes.io/name: {{ include "common.names.fullname" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}