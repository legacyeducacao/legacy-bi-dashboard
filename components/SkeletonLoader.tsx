
import React from 'react';

// Base Primitive
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg ${className}`} />
);

// Specific Component Skeletons

export const SkeletonMetricCard = () => (
  <div className="bg-white dark:bg-slate-800/50 rounded-xl p-5 border border-slate-200 dark:border-slate-700/50 shadow-sm h-[140px] flex flex-col justify-between relative overflow-hidden">
    <div className="flex justify-between items-start">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-5 w-5 rounded-full" />
    </div>
    <div className="flex items-baseline gap-2 mt-2">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-12" />
    </div>
    <div className="space-y-2 mt-4">
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  </div>
);

export const SkeletonChart = ({ className }: { className?: string }) => (
  <div className={`bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm flex flex-col ${className}`}>
    <div className="flex justify-between items-center mb-6">
       <Skeleton className="h-4 w-40" />
       <Skeleton className="h-5 w-16" />
    </div>
    <Skeleton className="flex-1 w-full rounded-lg" />
  </div>
);

export const SkeletonTable = ({ rows = 5 }: { rows?: number }) => (
  <div className="w-full bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden shadow-sm h-full flex flex-col">
    <div className="p-4 border-b border-slate-200 dark:border-slate-700/50">
      <Skeleton className="h-4 w-48" />
    </div>
    <div className="p-4 space-y-4 flex-1">
       {Array.from({ length: rows }).map((_, i) => (
         <div key={i} className="flex justify-between gap-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/6" />
         </div>
       ))}
    </div>
  </div>
);

export const SkeletonRankingWidget = () => (
    <div className="bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm h-full flex flex-col p-4 gap-4">
        <div className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-4" />
        </div>
        <div className="space-y-3 flex-1">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="space-y-1">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-2 w-12" />
                        </div>
                    </div>
                    <Skeleton className="h-4 w-12" />
                </div>
            ))}
        </div>
    </div>
);

export const SkeletonAnalysis = () => (
    <div className="flex flex-col h-full gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 h-40">
                <Skeleton className="w-full h-full rounded-xl" />
            </div>
            <div className="lg:col-span-3 h-40">
                <Skeleton className="w-full h-full rounded-xl" />
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
             <div className="space-y-3">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
             </div>
             <div className="space-y-3">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
             </div>
             <div className="space-y-3">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
             </div>
        </div>
    </div>
);
