{{/*
Define evironment variables
*/}}
{{- define "base-chart.environmentVariables" -}}
{{- range $key, $val := .Values.environmentVariables.plain }}
- name: {{ $key }}
  value: {{ $val | quote }}
{{- end }}
{{- end -}}

{{- define "base-chart.environmentVariablesFrom" -}}
{{- if and .Values.sealedSecrets.data .Values.sealedSecrets.autoMountAsEnv }}
- secretRef:
    name: {{ include "common.names.fullname" . }}
{{- end }}
{{- if .Values.existingConfigMap }}
{{- range $name := .Values.existingConfigMap }}
- configMapRef:
    name: {{ $name }}
{{- end }}
{{- end }}
{{- if .Values.existingSecretMap }}
{{- range $name := .Values.existingSecretMap }}
- secretRef:
    name: {{ $name }}
{{- end }}
{{- end }}
{{- end }}