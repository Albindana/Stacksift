{{/* Common labels applied to every object. */}}
{{- define "stacksift.labels" -}}
app.kubernetes.io/name: stacksift
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{/* Per-component selector labels. Usage: include "stacksift.selector" (dict "ctx" . "component" "api") */}}
{{- define "stacksift.selector" -}}
app.kubernetes.io/name: stacksift
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/* Resolve an image ref. Usage: include "stacksift.image" (dict "img" .Values.images.api "reg" .Values.images.registry) */}}
{{- define "stacksift.image" -}}
{{ .reg }}/{{ .img.repo }}:{{ .img.tag }}
{{- end -}}

{{/* The pre-created app Secret name. */}}
{{- define "stacksift.appSecret" -}}{{ .Values.global.appSecretName }}{{- end -}}

{{/* cert-manager annotation key for the configured issuer kind. */}}
{{- define "stacksift.certAnnoKey" -}}
{{- if eq .Values.certIssuer.kind "ClusterIssuer" -}}cert-manager.io/cluster-issuer{{- else -}}cert-manager.io/issuer{{- end -}}
{{- end -}}

{{/* Active issuer name (staging vs prod). */}}
{{- define "stacksift.certIssuerName" -}}
{{- if .Values.certIssuer.useStaging -}}{{ .Values.certIssuer.name }}-staging{{- else -}}{{ .Values.certIssuer.name }}{{- end -}}
{{- end -}}

{{/* pgBackRest NON-secret repo config. MUST set every PGBACKREST_* the overlay
     template references — the overlay's `${VAR:=default}` fallbacks are not
     exported, so envsubst renders any omitted key empty and pgbackrest then
     errors "key '<x>' must have a value". Shared by the postgres pod (archive),
     the stanza-create Job, and the backup CronJobs.
     NOTE: pgBackRest's S3 driver requires HTTPS — it has no plain-http option
     (unlike the ES S3 client). The in-namespace MinIO is plain http, so backups
     stay disabled until MinIO serves TLS. See values.yaml postgres.backups. */}}
{{- define "stacksift.pgbackrest.repoEnv" -}}
- { name: PGBACKREST_REPO1_TYPE, value: "s3" }
{{- if .Values.minio.tls.enabled }}
{{/* via the TLS proxy sidecar: minio:443 (Service) → nginx :9443 → MinIO :9000.
     pgBackRest only speaks HTTPS; verify-tls=n accepts the self-signed leaf. */}}
- { name: PGBACKREST_REPO1_S3_ENDPOINT, value: "minio" }
{{- else }}
- { name: PGBACKREST_REPO1_S3_ENDPOINT, value: {{ .Values.postgres.backups.s3.endpoint | quote }} }
{{- end }}
- { name: PGBACKREST_REPO1_S3_BUCKET, value: {{ .Values.postgres.backups.s3.bucket | quote }} }
- { name: PGBACKREST_REPO1_S3_REGION, value: {{ .Values.postgres.backups.s3.region | quote }} }
- { name: PGBACKREST_REPO1_S3_URI_STYLE, value: {{ .Values.postgres.backups.s3.uriStyle | quote }} }
- { name: PGBACKREST_REPO1_STORAGE_VERIFY_TLS, value: {{ .Values.postgres.backups.s3.verifyTls | quote }} }
- { name: PGBACKREST_REPO1_PATH, value: "/stacksift" }
- { name: PGBACKREST_REPO1_CIPHER_TYPE, value: "aes-256-cbc" }
- { name: PGBACKREST_REPO1_RETENTION_FULL, value: {{ .Values.postgres.backups.retention.full | quote }} }
- { name: PGBACKREST_REPO1_RETENTION_DIFF, value: {{ .Values.postgres.backups.retention.diff | quote }} }
- { name: PGBACKREST_REPO1_RETENTION_ARCHIVE, value: {{ .Values.postgres.backups.retention.archive | quote }} }
- { name: PGBACKREST_PROCESS_MAX, value: "2" }
- { name: PGBACKREST_LOG_LEVEL_CONSOLE, value: "info" }
- { name: PGBACKREST_LOG_LEVEL_FILE, value: "detail" }
- { name: PGBACKREST_PG1_PATH, value: "/var/lib/postgresql/data/pgdata" }
- { name: PGBACKREST_PG1_PORT, value: "5432" }
- { name: PGBACKREST_PG1_USER, value: "stacksift" }
{{- end -}}

{{/* pgBackRest env for the stanza-create Job + backup CronJobs: the repo config
     + hard secret refs + a libpq connection to postgres. */}}
{{- define "stacksift.pgbackrest.env" -}}
{{ include "stacksift.pgbackrest.repoEnv" . }}
- name: PGBACKREST_REPO1_S3_KEY
  valueFrom: { secretKeyRef: { name: {{ .Values.postgres.backups.secretName }}, key: access-key } }
- name: PGBACKREST_REPO1_S3_KEY_SECRET
  valueFrom: { secretKeyRef: { name: {{ .Values.postgres.backups.secretName }}, key: secret-key } }
- name: PGBACKREST_REPO1_CIPHER_PASS
  valueFrom: { secretKeyRef: { name: {{ .Values.postgres.backups.secretName }}, key: cipher-pass } }
- { name: PGHOST, value: "postgres" }
- name: PGUSER
  valueFrom: { secretKeyRef: { name: {{ include "stacksift.appSecret" . }}, key: POSTGRES_USER } }
- name: PGPASSWORD
  valueFrom: { secretKeyRef: { name: {{ include "stacksift.appSecret" . }}, key: POSTGRES_PASSWORD } }
- name: PGDATABASE
  valueFrom: { secretKeyRef: { name: {{ include "stacksift.appSecret" . }}, key: POSTGRES_DB } }
{{- end -}}

{{/* The postgres image ref (also carries pgBackRest + the overlay entrypoint). */}}
{{- define "stacksift.postgresImage" -}}
{{ .Values.postgres.image | default (printf "%s/%s:%s" .Values.images.registry .Values.images.postgres.repo .Values.images.postgres.tag) }}
{{- end -}}
