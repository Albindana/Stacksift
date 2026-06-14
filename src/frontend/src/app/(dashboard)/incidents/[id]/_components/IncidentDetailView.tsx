'use client';

import { useEffect } from 'react';
import { useIncident, useIncidentAlerts } from '@/app/hooks/queries/use-incidents';
import { useAiAnalysis } from '@/app/hooks/queries/use-ai-analysis';
import { useSimilarIncidents } from '@/app/hooks/queries/use-similar-incidents';
import { useUpdateIncidentStatus } from '@/app/hooks/mutations/use-update-incident-status';
import { useTriggerAiAnalysis } from '@/app/hooks/mutations/use-trigger-ai-analysis';
import { useFeatureFlag } from '@/app/hooks/queries/use-features';
import { trackEvent, AnalyticsEvent } from '@/app/lib/analytics';
import { Skeleton } from '@/app/components/ui/Skeleton';
import { IncidentHeader } from './IncidentHeader';
import { AlertsTimeline } from './AlertsTimeline';
import { AiAnalysisPanel } from './AiAnalysisPanel';
import { SimilarIncidents } from './SimilarIncidents';

interface IncidentDetailViewProps {
  id: string;
}

export function IncidentDetailView({ id }: IncidentDetailViewProps) {
  const { data: incident, isLoading: incidentLoading } = useIncident(id);
  const { data: alerts = [], isLoading: alertsLoading } = useIncidentAlerts(id);
  const { data: similar = [], isLoading: similarLoading } = useSimilarIncidents(id);

  const updateStatus = useUpdateIncidentStatus();
  const triggerAnalysis = useTriggerAiAnalysis();

  const analysisId = incident?.aiAnalysisId ?? triggerAnalysis.data?.id ?? null;
  const { data: aiAnalysis } = useAiAnalysis(analysisId);

  // M6.4 A/B test: "ab-ai-prominent" flag → treatment shows AI panel above timeline.
  // Control (flag off): AI panel in sidebar (original layout).
  // Treatment (flag on): AI panel surfaced as first item in the main column.
  const aiProminent = useFeatureFlag('ab-ai-prominent');

  useEffect(() => {
    if (incidentLoading) return;
    trackEvent(AnalyticsEvent.AbVariantViewed, {
      experiment: 'ai-analysis-placement',
      variant: aiProminent ? 'treatment' : 'control',
      incident_id: id,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentLoading]);

  if (incidentLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-40 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="col-span-2 flex flex-col gap-6">
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
          <div className="flex flex-col gap-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center text-sm text-muted">
        Incident not found.
      </div>
    );
  }

  const aiPanel = (
    <AiAnalysisPanel
      analysisId={analysisId}
      aiAnalysis={aiAnalysis}
      isTriggeringAnalysis={triggerAnalysis.isPending}
      onTrigger={() => triggerAnalysis.mutate({ incidentId: id })}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <IncidentHeader
        incident={incident}
        onUpdateStatus={(status) => updateStatus.mutate({ incidentId: id, status })}
        isUpdating={updateStatus.isPending}
      />

      {/* Treatment (ab-ai-prominent): AI panel surfaced above the timeline */}
      {aiProminent && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-1">
          {aiPanel}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column: alerts timeline */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <AlertsTimeline alerts={alerts} isLoading={alertsLoading} />
        </div>

        {/* Right column: similar incidents + AI panel (control only) */}
        <div className="flex flex-col gap-6">
          {!aiProminent && aiPanel}
          <SimilarIncidents items={similar} isLoading={similarLoading} />
        </div>
      </div>
    </div>
  );
}
