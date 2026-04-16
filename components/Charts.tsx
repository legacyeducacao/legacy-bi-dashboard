
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, ReferenceLine, AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { FunnelStage, MetricData } from '../types';
import { formatValue } from '../utils/calculations';

// Updated Palette for "Neon/Dark Mode" aesthetics
// Replaced grays with cool spectrum colors + warm accents for better differentiation
const COLORS = [
  '#1895D8', // Brand Primary (Blue)
  '#22d3ee', // Cyan 400 (Neon Blue)
  '#8b5cf6', // Violet 500 (Deep Purple)
  '#f472b6', // Pink 400 (Soft Neon Pink)
  '#34d399', // Emerald 400 (Soft Green)
  '#fbbf24', // Amber 400 (Soft Orange)
];

// UX Colors
const COLOR_SUCCESS = '#10b981'; // Emerald 500
const COLOR_DANGER = '#f43f5e';  // Rose 500
const COLOR_NEUTRAL = '#1895D8'; // Brand Blue
const COLOR_PROJECTION = '#17ADFD'; // Brand Light

// --- Funnel Chart ---
interface FunnelChartProps {
  data: FunnelStage[];
  isDarkMode?: boolean;
  className?: string;
}

export const FunnelChart: React.FC<FunnelChartProps> = ({ data, isDarkMode = true, className }) => {
  return (
    <div className={`w-full bg-white dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none flex flex-col ${className || 'h-full'}`}>
      <h3 className="text-slate-700 dark:text-slate-300 font-medium mb-4 text-sm flex-shrink-0">Funil de Vendas</h3>
      <div className="flex-1 min-h-0 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} horizontal={false} />
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              width={100}
              tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                color: isDarkMode ? '#f8fafc' : '#0f172a'
              }}
              itemStyle={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              labelStyle={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              cursor={{ fill: 'transparent' }}
              formatter={(value: number) => [formatValue(value, 'number'), '']}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.9} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// --- Trend Chart (Daily) ---
interface TrendChartProps {
  data: any[];
  dataKeyBar?: string;
  dataKeyLine?: string;
  targetValue?: number; // Fixed monthly target / days
  title: string;
  isDarkMode?: boolean;
  className?: string;
  unit?: MetricData['unit'];
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  dataKeyBar,
  dataKeyLine,
  targetValue,
  title,
  isDarkMode = true,
  className,
  unit = 'number'
}) => {
  return (
    <div className={`w-full bg-white dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none flex flex-col ${className || 'h-full'}`}>
      <h3 className="text-slate-700 dark:text-slate-300 font-medium mb-4 text-sm flex-shrink-0">{title}</h3>
      <div className="flex-1 min-h-0 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} opacity={0.3} />
            <XAxis
              dataKey="day"
              tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              dx={-10}
              tickFormatter={(val) => unit === 'currency' ? `R$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}` : val}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                color: isDarkMode ? '#f8fafc' : '#0f172a',
                borderRadius: '8px'
              }}
              itemStyle={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              labelStyle={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              formatter={(value: number | string, name: string) => [formatValue(Number(value), unit as MetricData['unit']), name === dataKeyBar ? 'Realizado' : (name === dataKeyLine ? 'Tendência' : name)]}
            />

            {/* Fixed Daily Target Line */}
            {targetValue && (
              <ReferenceLine
                y={targetValue}
                stroke={COLOR_SUCCESS}
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{
                  position: 'insideTopRight',
                  value: 'Meta',
                  fill: COLOR_SUCCESS,
                  fontSize: 10
                }}
              />
            )}

            {/* Dynamic Colored Bars */}
            {dataKeyBar && (
              <Bar dataKey={dataKeyBar} barSize={24} radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => {
                  const val = entry[dataKeyBar!];
                  const isSuccess = targetValue ? val >= targetValue : true;
                  return <Cell key={`cell-${index}`} fill={isSuccess ? COLOR_SUCCESS : COLOR_DANGER} fillOpacity={0.8} />;
                })}
              </Bar>
            )}

            {dataKeyLine && (
              <Line
                type="monotone"
                dataKey={dataKeyLine}
                stroke={COLOR_PROJECTION}
                strokeWidth={3}
                dot={{ r: 3, fill: COLOR_PROJECTION, strokeWidth: 2, stroke: isDarkMode ? '#0f172a' : '#fff' }}
                activeDot={{ r: 5 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// --- Goal Achievement Chart (Accumulated Pace) ---
interface GoalAchievementChartProps {
  currentData: any[]; // Daily data
  dataKey: string;    // Key to accumulate
  goal: number;       // Total monthly goal
  totalDays: number;
  currentDay: number;
  title: string;
  isDarkMode?: boolean;
  className?: string;
  unit?: MetricData['unit'];
}

export const GoalAchievementChart: React.FC<GoalAchievementChartProps> = ({
  currentData,
  dataKey,
  goal,
  totalDays,
  currentDay,
  title,
  isDarkMode = true,
  className,
  unit = 'currency' // Default to currency as it's mostly used for revenue
}) => {
  // Process Data for Accumulated View
  const chartData = [];
  let runningTotal = 0;

  for (let i = 1; i <= totalDays; i++) {
    const goalValue = (goal / totalDays) * i;
    let actualValue = null;
    if (i <= currentDay) {
      const dayData = currentData[i - 1];
      const dailyVal = dayData ? dayData[dataKey] : 0;
      runningTotal += dailyVal;
      actualValue = runningTotal;
    }
    chartData.push({
      day: i,
      goal: Math.round(goalValue),
      actual: actualValue,
    });
  }

  // Projection logic
  const currentTotal = runningTotal;
  const avgPace = currentDay > 0 ? currentTotal / currentDay : 0;

  chartData.forEach(point => {
    if (point.day >= currentDay) {
      const daysFromNow = point.day - currentDay;
      point.projection = Math.round(currentTotal + (avgPace * daysFromNow));
    }
  });

  // Calculate percentage of goal achieved
  const percentAchieved = Math.min((currentTotal / goal) * 100, 100).toFixed(1);

  // Determine if Currently On Track (for color selection)
  const idealPaceToday = (goal / totalDays) * currentDay;
  const isOnTrack = currentTotal >= idealPaceToday;

  return (
    <div className={`w-full bg-white dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none flex flex-col ${className || 'h-full'}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-slate-700 dark:text-slate-300 font-medium text-sm">{title}</h3>
        <span className={`text-xs font-bold px-2 py-1 rounded ${isOnTrack ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
          {percentAchieved}% da Meta
        </span>
      </div>
      <div className="flex gap-4 mb-2 text-[10px]">
        <div><span className="text-slate-400">Realizado: </span><span className="text-white font-bold">{formatValue(currentTotal, unit as MetricData['unit'])}</span></div>
        <div><span className="text-slate-400">Meta: </span><span className="text-slate-300">{formatValue(goal, unit as MetricData['unit'])}</span></div>
        <div><span className="text-slate-400">Projeção: </span><span className={`font-bold ${isOnTrack ? 'text-emerald-400' : 'text-rose-400'}`}>{formatValue(Math.round(avgPace * totalDays), unit as MetricData['unit'])}</span></div>
      </div>

      <div className="flex-1 min-h-0 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorActualSuccess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLOR_SUCCESS} stopOpacity={0.6} />
                <stop offset="95%" stopColor={COLOR_SUCCESS} stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorActualDanger" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLOR_DANGER} stopOpacity={0.6} />
                <stop offset="95%" stopColor={COLOR_DANGER} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} opacity={0.3} />
            <XAxis
              dataKey="day"
              type="number"
              domain={[1, totalDays]}
              tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                color: isDarkMode ? '#f8fafc' : '#0f172a',
                borderRadius: '8px'
              }}
              itemStyle={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              labelStyle={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              labelFormatter={(label) => `Dia ${label}`}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = { 'Meta Ideal': 'Meta Ideal', 'Projeção': 'Projeção', 'Faturamento': 'Faturamento Acumulado' };
                return [formatValue(value, unit as MetricData['unit']), labels[name] || name];
              }}
            />

            {/* Goal Line (Dotted) */}
            <Area
              type="monotone"
              dataKey="goal"
              stroke="#94a3b8"
              strokeDasharray="4 4"
              fill="none"
              strokeWidth={2}
              name="Meta Ideal"
              isAnimationActive={false}
            />

            {/* Projection Line (Dashed) - Always Blue as it is future */}
            <Area
              type="monotone"
              dataKey="projection"
              stroke={COLOR_PROJECTION}
              strokeDasharray="2 2"
              fill="none"
              strokeWidth={2}
              name="Projeção"
              connectNulls
            />

            {/* Actual Area - Dynamic Color */}
            <Area
              type="monotone"
              dataKey="actual"
              stroke={isOnTrack ? COLOR_SUCCESS : COLOR_DANGER}
              fill={isOnTrack ? "url(#colorActualSuccess)" : "url(#colorActualDanger)"}
              strokeWidth={3}
              name="Faturamento"
            />

          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// --- Micro Chart (Horizontal Bar for Drilldowns) ---
interface MicroChartProps {
  data: { name: string; value: number }[];
  title: string;
  isDarkMode?: boolean;
  className?: string;
  unit?: MetricData['unit'];
}

export const MicroChart: React.FC<MicroChartProps> = ({ data, title, isDarkMode = true, className, unit = 'number' }) => {
  // Sort data descending
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className={`w-full bg-white dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none flex flex-col ${className || 'h-full'}`}>
      <h3 className="text-slate-700 dark:text-slate-300 font-medium mb-4 text-sm flex-shrink-0">{title}</h3>
      <div className="flex-1 min-h-0 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={sortedData}
            margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
            barCategoryGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} horizontal={false} opacity={0.3} />
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              width={90}
              tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              contentStyle={{
                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                color: isDarkMode ? '#f8fafc' : '#0f172a'
              }}
              itemStyle={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              labelStyle={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              formatter={(value: number) => [formatValue(value, unit as MetricData['unit']), '']}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
              {sortedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// --- Donut Chart ---
interface DonutChartProps {
  data: { name: string; value: number }[];
  title: string;
  isDarkMode?: boolean;
  className?: string;
  unit?: MetricData['unit'];
}

export const DonutChart: React.FC<DonutChartProps> = ({ data, title, isDarkMode = true, className, unit = 'number' }) => {
  return (
    <div className={`w-full bg-white dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none flex flex-col ${className || 'h-full'}`}>
      <h3 className="text-slate-700 dark:text-slate-300 font-medium mb-2 text-sm flex-shrink-0">{title}</h3>
      <div className="flex-1 min-h-0 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              fill="#8884d8"
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                color: isDarkMode ? '#f8fafc' : '#0f172a'
              }}
              itemStyle={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
              formatter={(value: number) => [formatValue(value, unit as MetricData['unit']), '']}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', color: isDarkMode ? '#94a3b8' : '#64748b' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
