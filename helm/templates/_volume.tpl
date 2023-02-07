{{/*
Define deployment volumes
*/}}
{{- define "base-chart.deploymentVolumes" -}}
{{- if .Values.volumes }}
{{- include "common.tplvalues.render" (dict "value" .Values.volumes "context" $) | nindent 0 }}
{{- end }}
{{- end -}}

{{/*
Define deployment volumeMounts
*/}}
{{- define "base-chart.deploymentVolumeMounts" -}}
{{- if .Values.volumeMounts }}
{{- include "common.tplvalues.render" (dict "value" .Values.volumeMounts "context" $) | nindent 0 }}
{{- end }}
{{- end -}}
