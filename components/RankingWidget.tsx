
import React from 'react';
import { Trophy, Medal, Award, TrendingDown, TrendingUp } from 'lucide-react';

interface RankingWidgetProps<T> {
  title: string;
  icon?: React.ReactNode;
  data: T[];
  accessor: (item: T) => number;
  labelAccessor: (item: T) => string;
  formatValue: (val: number) => string;
  inverse?: boolean; // True if lower is better (e.g. No Show, Response Time)
}

const RankingWidget = <T,>({ 
  title, 
  icon, 
  data, 
  accessor, 
  labelAccessor,
  formatValue,
  inverse = false 
}: RankingWidgetProps<T>) => {
  
  // Sort Data
  const sortedData = [...data].sort((a, b) => {
    const valA = accessor(a);
    const valB = accessor(b);
    return inverse ? valA - valB : valB - valA;
  });

  const top5 = sortedData.slice(0, 5);

  const getRankStyle = (index: number) => {
    switch (index) {
      case 0: return { 
        bg: 'bg-yellow-100 dark:bg-yellow-500/10', 
        text: 'text-yellow-600 dark:text-yellow-400', 
        border: 'border-yellow-200 dark:border-yellow-500/30',
        icon: <Trophy className="w-4 h-4 text-yellow-500" />
      };
      case 1: return { 
        bg: 'bg-slate-100 dark:bg-slate-500/10', 
        text: 'text-slate-600 dark:text-slate-300', 
        border: 'border-slate-200 dark:border-slate-500/30',
        icon: <Medal className="w-4 h-4 text-slate-400" />
      };
      case 2: return { 
        bg: 'bg-amber-100 dark:bg-amber-700/10', 
        text: 'text-amber-700 dark:text-amber-500', 
        border: 'border-amber-200 dark:border-amber-600/30',
        icon: <Medal className="w-4 h-4 text-amber-600" />
      };
      default: return { 
        bg: 'bg-transparent', 
        text: 'text-slate-500 dark:text-slate-400', 
        border: 'border-transparent border-b border-slate-100 dark:border-slate-700/50',
        icon: <span className="w-4 h-4 flex items-center justify-center text-xs font-bold opacity-50">{index + 1}</span>
      };
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
        <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wide flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {inverse ? 
          <span title="Menor é melhor"><TrendingDown className="w-4 h-4 text-slate-400" /></span> : 
          <span title="Maior é melhor"><TrendingUp className="w-4 h-4 text-slate-400" /></span>
        }
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {top5.map((item, index) => {
          const style = getRankStyle(index);
          const value = accessor(item);
          
          return (
            <div 
              key={index} 
              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${style.bg} ${style.border}`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm ${index < 3 ? 'scale-110' : ''}`}>
                   {style.icon}
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold ${style.text}`}>
                    {labelAccessor(item)}
                  </span>
                  {index === 0 && (
                    <span className="text-[10px] uppercase font-bold text-slate-400 leading-none">Líder</span>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <span className={`text-sm font-bold ${index === 0 ? style.text : 'text-slate-700 dark:text-slate-200'}`}>
                   {formatValue(value)}
                </span>
              </div>
            </div>
          );
        })}
        {data.length === 0 && (
            <div className="h-20 flex items-center justify-center text-xs text-slate-400 italic">
                Sem dados para ranking
            </div>
        )}
      </div>
    </div>
  );
};

export default RankingWidget;
