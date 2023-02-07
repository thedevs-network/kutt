{{/*
Define topologySpreadConstraints
*/}}
{{- define "base-chart.topologySpreadConstraints" -}}
{{- if .Values.topologySpreadConstraints.enabled }}
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels:
        {{- include "base.labels.matchLabels" . | nindent 8 }}
{{- end -}}
{{- end -}}
