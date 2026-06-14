'use client';

import { useDashboardStats } from '@/app/hooks/queries/use-dashboard-stats';
import { useProjects } from '@/app/hooks/queries/use-projects';
import { useCurrentOrganization } from '@/app/hooks/queries/use-organization';
import { Card, CardBody } from '@/app/components/ui/Card';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { cn } from '@/app/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SystemStatus = 'healthy' | 'elevated' | 'incident';

function deriveStatus(
  openIncidents: number,
  activeAlerts: number,
): SystemStatus {
  if (openIncidents > 0) return 'incident';
  if (activeAlerts > 0) return 'elevated';
  return 'healthy';
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

// ---------------------------------------------------------------------------
// Status banner
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  SystemStatus,
  { label: string; description: string; dot: string; banner: string }
> = {
  healthy: {
    label: 'All Systems Operational',
    description: 'No active issues detected. Engineering systems are running normally.',
    dot: 'bg-green-500',
    banner: 'border-green-500/30 bg-green-500/5',
  },
  elevated: {
    label: 'Elevated Alerts',
    description: 'Our team is reviewing automated warnings. No active incidents at this time.',
    dot: 'bg-amber-400',
    banner: 'border-amber-400/30 bg-amber-400/5',
  },
  incident: {
    label: 'Active Incident',
    description: 'Engineering is actively investigating an issue. Updates will follow.',
    dot: 'bg-red-500',
    banner: 'border-red-500/30 bg-red-500/5',
  },
};

interface StatusBannerProps {
  status: SystemStatus;
  loading: boolean;
}

function StatusBanner({ status, loading }: StatusBannerProps) {
  if (loading) {
    return <Skeleton className="h-20 w-full rounded-lg" />;
  }

  const cfg = STATUS_CONFIG[status];

  return (
    <div className={cn('flex items-center gap-4 rounded-lg border p-5', cfg.banner)}>
      <span className={cn('h-4 w-4 shrink-0 rounded-full', cfg.dot)} aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <p className="text-base font-semibold">{cfg.label}</p>
        <p className="text-sm text-muted">{cfg.description}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  value: string | number;
  label: string;
  note: string;
  loading?: boolean;
}

function KpiCard({ value, label, note, loading }: KpiCardProps) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-2">
        {loading ? (
          <Skeleton className="h-10 w-20 rounded-md" />
        ) : (
          <p className="text-4xl font-bold tabular-nums">{value}</p>
        )}
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">{note}</p>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StakeholderPage() {
  const stats = useDashboardStats();
  const projects = useProjects();
  const org = useCurrentOrganization();

  const loading = stats.isLoading;
  const openIncidents = stats.data?.openIncidentCount ?? 0;
  const activeAlerts = stats.data?.activeAlertCount ?? 0;
  const logsToday = stats.data?.totalLogsToday ?? 0;
  const projectCount = projects.data?.length ?? 0;
  const orgName = org.data?.name ?? 'Your Organization';

  const status = loading
    ? 'healthy'
    : deriveStatus(openIncidents, activeAlerts);

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Executive Overview</h1>
        <p className="text-sm text-muted mt-1">
          {orgName} · Key performance indicators · Refreshed every 30 seconds
        </p>
      </div>

      {/* System status */}
      <StatusBanner status={status} loading={loading} />

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          value={loading ? '—' : openIncidents}
          label="Issues Being Investigated"
          note="Active problems our engineering team is working on right now."
          loading={loading}
        />
        <KpiCard
          value={loading ? '—' : activeAlerts}
          label="Alerts Under Review"
          note="Automated warnings raised by our monitoring systems today."
          loading={loading}
        />
        <KpiCard
          value={loading ? '—' : formatNumber(logsToday)}
          label="Events Monitored Today"
          note="Application records our AI reviewed for anomalies since midnight."
          loading={loading}
        />
      </div>

      {/* Coverage card */}
      <Card>
        <CardBody className="flex flex-col gap-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Monitoring Coverage
          </p>
          <p className="text-lg font-semibold">
            {projects.isLoading ? (
              <Skeleton className="inline-block h-5 w-8 rounded" />
            ) : (
              `${projectCount} ${projectCount === 1 ? 'project' : 'projects'} connected`
            )}
          </p>
          <p className="text-sm text-muted">
            Each connected project has its logs ingested, analyzed, and monitored in real time.
          </p>
        </CardBody>
      </Card>

      {/* Plain-language glossary */}
      <div className="rounded-lg border border-line bg-elevated/40 p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted mb-3">
          Glossary
        </p>
        <ul className="flex flex-col gap-2 text-sm text-muted">
          <li>
            <span className="font-medium text-primary">Issue (Incident)</span>
            {' '}— A confirmed system problem. Zero issues means everything is running as expected.
          </li>
          <li>
            <span className="font-medium text-primary">Alert</span>
            {' '}— An automated warning from our monitoring rules. Alerts are reviewed by engineers and may or may not become incidents.
          </li>
          <li>
            <span className="font-medium text-primary">Events</span>
            {' '}— Application log records. High volume is normal and expected; our AI flags only the anomalies.
          </li>
        </ul>
      </div>
    </div>
  );
}
