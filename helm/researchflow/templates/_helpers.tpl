{{/*
Phase A - Task 9: Helm template helpers
*/}}

{{/*
Expand the name of the chart.
*/}}
{{- define "researchflow.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "researchflow.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- printf "%s" $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "researchflow.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "researchflow.labels" -}}
helm.sh/chart: {{ include "researchflow.chart" . }}
{{ include "researchflow.selectorLabels" . }}
app.kubernetes.io/version: {{ .Values.image.orchestrator.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "researchflow.selectorLabels" -}}
app.kubernetes.io/name: {{ include "researchflow.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create image reference
*/}}
{{- define "researchflow.image" -}}
{{- $registry := .Values.image.registry -}}
{{- $prefix := .Values.image.prefix -}}
{{- printf "%s/%s/%s:%s" $registry $prefix .repository .tag }}
{{- end }}
