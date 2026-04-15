
import React from 'react';
import { MetricData, PeriodContext } from '../types';
import { calculatePace, formatValue } from '../utils/calculations';
import { TrendingUp, Target, AlertCircle, ArrowRightLeft } from 'lucide-react';

interface MetricCardProps {
  metric: MetricData;
  context: PeriodContext;
  showPace?: boolean;
  inverse?: boolean; // If true, lower values are better (e.g., Cost)
  variant?: 'default' | 'compact' | 'funnel';
  customComparison?: {
    value: number;
    label: string;
    unit?: MetricData['unit']; // Optional unit override for comparison value
    suffix?: string;
  };
}

const MetricCard: React.FC<MetricCardProps> = ({
  metric,
  context,
  showPace = true,
  inverse = false,
  variant = 'default',
  customComparison
}) => {
  const isCompact = variant === 'compact';
  const analysis = calculatePace(metric, context);

  // Determine Status (Green/Red)
  let isOnTrack = analysis.isOnTrack;

  // Logic adjustment for inverse metrics (e.g. Cost: Lower is better)
  if (inverse) {
    // For inverse metrics, we compare against the goal or provisioned cap
    const valueToCheck = analysis.projection;
    isOnTrack = valueToCheck <= (metric.goal * 1.05);
  } else if (customComparison) {
    // If comparing, usually we just want to see if the Main Metric is healthy regardless of the secondary metric shown
    // So we revert to standard Pace check for the main metric
    // (Previously this logic tried to compare main value vs custom comparison which was wrong for Leads vs CPL)
    isOnTrack = analysis.isOnTrack;
  }

  // Visual percentages
  const percentOfGoal = Math.min((metric.value / metric.goal) * 100, 100);

  // Marker Configuration (ALWAYS Pace/Meta for the visual bar)
  // Check if snapshot (Marker is effectively 100%)
  const isSnapshot = analysis.provisioned === metric.goal;

  const markerPercent = Math.min((analysis.provisioned / metric.goal) * 100, 100);
  const markerLabel = isSnapshot ? 'Meta' : 'Ritmo Ideal';
  const markerValueStr = formatValue(analysis.provisioned, metric.unit, metric.prefix, metric.suffix);

  // Calculate "Falta Dia" (Daily shortfall to reach goal)
  const remainingDays = Math.max(1, context.totalDays - context.currentDay);
  const shortfall = Math.max(0, metric.goal - metric.value);
  const dailyShortfall = shortfall / remainingDays;
  const showFaltaDia = metric.goal > 0 && metric.unit !== 'percentage' && !inverse && shortfall > 0;

  // UX Colors
  // Success = Emerald (Green), Danger = Rose (Red), Projection/Neutral = Blue
  const statusColor = isOnTrack ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400';
  const iconColor = isOnTrack ? 'text-emerald-500' : 'text-rose-500';

  // Progress Bar Color: Green if good, Red if bad
  const progressBarColor = isOnTrack
    ? 'bg-emerald-500'
    : 'bg-rose-500';

  const borderClass = isOnTrack
    ? 'border-emerald-500/20 dark:border-emerald-500/20'
    : 'border-rose-500/20 dark:border-rose-500/20';

  const glowClass = isOnTrack
    ? 'shadow-[0_0_15px_rgba(16,185,129,0.15)]' // Emerald glow
    : 'shadow-[0_0_10px_rgba(244,63,94,0.15)]'; // Rose glow

  const DisplayIcon = customComparison ? ArrowRightLeft : (isOnTrack ? TrendingUp : AlertCircle);
  const isFunnel = variant === 'funnel';

  return (
    <div className={`
      relative bg-white dark:bg-slate-900/40 backdrop-blur-md rounded-xl border transition-all duration-300 hover:scale-[1.01] 
      ${borderClass} shadow-sm dark:shadow-none h-full flex flex-col
      ${isOnTrack ? 'dark:shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 'dark:shadow-[0_0_20px_rgba(244,63,94,0.05)]'}
      ${isCompact ? 'p-3' : isFunnel ? 'p-4' : 'p-5'}
    `}>

      {/* Header */}
      <div className="flex justify-between items-start mb-1 flex-shrink-0">
        <h3 className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest truncate mr-2" title={metric.description || metric.label}>{metric.label}</h3>
        <DisplayIcon className={`w-3 h-3 flex-shrink-0 ${iconColor}`} />
      </div>

      <div className="flex-1 flex flex-col justify-between">
        {/* Main Metric Value */}
        <div className={`flex items-baseline gap-2 ${isCompact || isFunnel ? 'mb-1' : 'mb-2'}`}>
          <span className={`
            ${isCompact ? 'text-xl' : isFunnel ? 'text-2xl' : 'text-3xl'} 
            font-bold text-slate-800 dark:text-white tracking-tight
          `}>
            {formatValue(metric.value, metric.unit, metric.prefix, metric.suffix)}
          </span>
          {(!isCompact && !isFunnel) && (
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              / {formatValue(metric.goal, metric.unit, metric.prefix, metric.suffix)}
            </span>
          )}
        </div>

        {(!isCompact && !isFunnel && (showPace || customComparison)) && (
          <div className="space-y-3">
            {/* Progress Bar Container with Space for Markers */}
            <div className="relative pt-2 pb-1">
              <div
                className="absolute top-0 z-30 flex flex-col items-center pointer-events-none transition-all duration-1000"
                style={{ left: `${markerPercent}%`, transform: 'translateX(-50%)' }}
              >
                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-slate-800 dark:border-t-white drop-shadow-sm mb-0.5"></div>
                <div className="w-[2px] h-4 bg-slate-800 dark:bg-white/80 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]"></div>
              </div>
              <div className="relative h-2 w-full bg-slate-100 dark:bg-slate-700/30 rounded-full overflow-hidden">
                <div className="absolute top-0 left-0 h-full bg-slate-300/30 dark:bg-white/5 border-r border-white/20 transition-all duration-1000" style={{ width: `${markerPercent}%` }} />
                <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${progressBarColor} z-10 shadow-sm`} style={{ width: `${percentOfGoal}%` }} />
              </div>
            </div>

            <div className={`flex w-full justify-between items-end gap-1 pt-1`}>
              <div className="flex flex-col border-l-2 border-slate-300 dark:border-slate-700 pl-1.5 min-w-0 flex-[1.2]">
                <span className="text-[8.5px] uppercase tracking-wider text-slate-500 font-bold mb-0.5 truncate">{markerLabel}</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none truncate">{markerValueStr}</span>
              </div>
              
              {(!customComparison && showFaltaDia) && (
                <div className="flex flex-col border-l-2 border-amber-500/30 pl-1.5 min-w-0 flex-1">
                  <span className="text-[8.5px] uppercase tracking-wider text-amber-600 dark:text-amber-500 font-bold mb-0.5 truncate">Falta / Dia</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none truncate">
                    {formatValue(dailyShortfall, metric.unit, metric.prefix, metric.suffix)}
                  </span>
                </div>
              )}

              <div className={`flex flex-col items-end border-r-2 ${isOnTrack ? 'border-emerald-500/30' : 'border-rose-500/30'} pr-1.5 min-w-0 flex-[1.3]`}>
                {customComparison ? (
                  <>
                    <span className="text-[8.5px] uppercase tracking-wider text-slate-500 font-bold mb-0.5 text-right truncate w-full">{customComparison.label}</span>
                    <span className="text-xs font-bold leading-none text-slate-700 dark:text-slate-200 truncate max-w-full">
                      {formatValue(customComparison.value, customComparison.unit || metric.unit, '', customComparison.suffix || '')}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[8.5px] uppercase tracking-wider text-slate-500 font-bold mb-0.5 text-right w-full truncate">Projeção</span>
                    <div className={`flex items-baseline justify-end gap-1 ${statusColor} w-full min-w-0`}>
                      <span className="text-xs font-bold leading-none truncate">{formatValue(analysis.projection, metric.unit, metric.prefix, metric.suffix)}</span>
                      <span className="text-[9px] font-bold opacity-80 flex-shrink-0">({analysis.projectionPercent.toFixed(0)}%)</span>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        )}

        {((isCompact || isFunnel) && customComparison) && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/50 mt-auto">
            <span className="text-[9px] text-slate-500 uppercase font-bold">{customComparison.label}</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {formatValue(customComparison.value, customComparison.unit || metric.unit, '', customComparison.suffix || '')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
