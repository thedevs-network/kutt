{{/*
Define liviness probe
*/}}
{{- define "base-chart.deploymentLivinessProbe" -}}
{{- if .Values.livenessProbeOverride }}
livenessProbe: {{- include "common.tplvalues.render" (dict "value" .Values.livenessProbeOverride "context" $) | nindent 2 }}
{{- else if .Values.containerPort.enabled }}
livenessProbe:
  httpGet:
    path: "/"
    port: {{ .Values.containerPort.name }}
{{- end }}
{{- end -}}


{{/*
Define readiness probe
*/}}
{{- define "base-chart.deploymentReadinessProbe" -}}
{{- if .Values.readinessProbeOverride }}
readinessProbe: {{- include "common.tplvalues.render" (dict "value" .Values.readinessProbeOverride "context" $) | nindent 2 }}
{{- else if .Values.containerPort.enabled }}
readinessProbe:
  httpGet:
    path: "/"
    port: {{ .Values.containerPort.name }}
{{- end }}
{{- end -}}

{{/*
Define startup probe
*/}}
{{- define "base-chart.deploymentStartupProbe" -}}
{{- if .Values.startupProbe }}
startupProbe: {{- include "common.tplvalues.render" (dict "value" .Values.startupProbe "context" $) | nindent 2 }}
{{- end }}
{{- end -}}