
import React from 'react';
import { MetricData, PeriodContext } from '../types';
import { calculatePace, formatValue } from '../utils/calculations';
import { TrendingUp, Target, AlertCircle, ArrowRightLeft } from 'lucide-react';

interface MetricCardProps {
  metric: MetricData;
  context: PeriodContext;
  showPace?: boolean;
  inverse?: boolean; // If true, lower values are better (e.g., Cost)
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
  customComparison 
}) => {
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

  return (
    <div className={`relative bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border transition-all duration-300 hover:scale-[1.01] ${borderClass} shadow-sm dark:shadow-none ${isOnTrack ? 'dark:' + glowClass : 'dark:' + glowClass}`}>
      
      {/* Header */}
      <div className="flex justify-between items-start mb-1">
        <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">{metric.label}</h3>
        <DisplayIcon className={`w-4 h-4 ${iconColor}`} />
      </div>

      {/* Main Metric Value */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
          {formatValue(metric.value, metric.unit, metric.prefix, metric.suffix)}
        </span>
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
          / {formatValue(metric.goal, metric.unit, metric.prefix, metric.suffix)}
        </span>
      </div>

      {(showPace || customComparison) && (
        <div className="space-y-3">
          
          {/* Progress Bar Container with Space for Markers */}
          <div className="relative pt-2 pb-1">
             
             {/* Target Marker (Needle/Triangle) - Always Pace/Meta */}
             <div 
                className="absolute top-0 z-30 flex flex-col items-center pointer-events-none transition-all duration-1000"
                style={{ left: `${markerPercent}%`, transform: 'translateX(-50%)' }}
             >
                {/* The Triangle Indicator */}
                <div className={`w-0 h-0 
                  border-l-[5px] border-l-transparent 
                  border-r-[5px] border-r-transparent 
                  border-t-[6px] border-t-slate-800 dark:border-t-white
                  drop-shadow-sm mb-0.5
                `}></div>
                
                {/* The Vertical Line cutting through the bar */}
                <div className="w-[2px] h-4 bg-slate-800 dark:bg-white/80 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]"></div>
             </div>

            {/* Track Background */}
            <div className="relative h-3 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
               
               {/* Ghost Bar (Ideal Pace Fill) */}
               <div 
                  className="absolute top-0 left-0 h-full bg-slate-300/50 dark:bg-white/5 border-r border-white/20 transition-all duration-1000"
                  style={{ width: `${markerPercent}%` }}
               />

               {/* Actual Progress Bar */}
               <div 
                 className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${progressBarColor} z-10 shadow-sm`} 
                 style={{ width: `${percentOfGoal}%` }}
               />
            </div>
          </div>

          {/* Data Footer */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            
            {/* Left: Pace Ideal Data */}
            <div className="flex flex-col border-l-2 border-slate-300 dark:border-slate-600 pl-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5">{markerLabel}</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none">
                {markerValueStr}
              </span>
            </div>
            
            {/* Right: Projection OR Custom Comparison */}
            <div className={`flex flex-col items-end border-r-2 ${isOnTrack ? 'border-emerald-500/50' : 'border-rose-500/50'} pr-2`}>
               {customComparison ? (
                 <>
                   <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5 text-right">{customComparison.label}</span>
                   <span className={`text-sm font-bold leading-none text-slate-700 dark:text-slate-200`}>
                     {formatValue(customComparison.value, customComparison.unit || metric.unit, '', customComparison.suffix || '')}
                   </span>
                 </>
               ) : (
                 <>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-0.5 text-right">Projeção</span>
                    <div className={`flex items-baseline gap-1 ${statusColor}`}>
                       <span className="text-sm font-bold leading-none">
                          {formatValue(analysis.projection, metric.unit, metric.prefix, metric.suffix)}
                       </span>
                       <span className="text-[10px] font-bold opacity-80">
                         ({analysis.projectionPercent.toFixed(0)}%)
                       </span>
                    </div>
                 </>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricCard;
