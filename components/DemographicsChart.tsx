import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { MetaDemographicData } from '../types';

interface DemographicsChartProps {
  demographics: MetaDemographicData;
  isDarkMode?: boolean;
}

const GENDER_COLORS: Record<string, string> = {
  'Masculino': '#3b82f6',
  'Feminino': '#ec4899',
  'Outro': '#8b5cf6',
};

const AGE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#6d28d9', '#7c3aed'];

const formatNumber = (n: number) => n.toLocaleString('pt-BR');
const formatCurrency = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const DemographicsChart: React.FC<DemographicsChartProps> = ({ demographics, isDarkMode = true }) => {
  // Aggregate gender data
  const genderData = useMemo(() => {
    const map = new Map<string, { impressions: number; clicks: number; spend: number; reach: number; leads: number }>();
    demographics.ageGender.forEach(row => {
      const existing = map.get(row.gender) || { impressions: 0, clicks: 0, spend: 0, reach: 0, leads: 0 };
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.spend += row.spend;
      existing.reach += row.reach;
      existing.leads += row.leads;
      map.set(row.gender, existing);
    });
    return Array.from(map.entries()).map(([name, values]) => ({
      name,
      value: values.reach,
      ...values,
    }));
  }, [demographics.ageGender]);

  // Aggregate age data
  const ageData = useMemo(() => {
    const map = new Map<string, { impressions: number; clicks: number; spend: number; reach: number; leads: number }>();
    demographics.ageGender.forEach(row => {
      const existing = map.get(row.age) || { impressions: 0, clicks: 0, spend: 0, reach: 0, leads: 0 };
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.spend += row.spend;
      existing.reach += row.reach;
      existing.leads += row.leads;
      map.set(row.age, existing);
    });
    return Array.from(map.entries())
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [demographics.ageGender]);

  // Top regions
  const regionData = useMemo(() => {
    return [...demographics.regions]
      .sort((a, b) => b.reach - a.reach)
      .slice(0, 10);
  }, [demographics.regions]);

  const tooltipStyle = {
    backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
    borderColor: isDarkMode ? '#334155' : '#e2e8f0',
    color: isDarkMode ? '#f8fafc' : '#0f172a',
  };

  const hasData = demographics.ageGender.length > 0 || demographics.regions.length > 0;

  if (!hasData) {
    return (
      <div className="w-full bg-white dark:bg-slate-800/30 rounded-xl p-6 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none text-center text-slate-400">
        Dados demográficos não disponíveis
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Gender Donut */}
      {genderData.length > 0 && (
        <div className="bg-white dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
          <h3 className="text-slate-700 dark:text-slate-300 font-medium mb-2 text-sm">Gênero</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={genderData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={5} dataKey="value">
                  {genderData.map((entry, i) => (
                    <Cell key={i} fill={GENDER_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatNumber(value), 'Alcance']} />
                <Legend
                  wrapperStyle={{ fontSize: '12px', color: isDarkMode ? '#94a3b8' : '#64748b' }}
                  formatter={(value: string) => <span style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1">
            {genderData.map(g => (
              <div key={g.name} className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{g.name}</span>
                <span>{formatCurrency(g.spend)} | {g.leads} leads</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Age Distribution Bar */}
      {ageData.length > 0 && (
        <div className="bg-white dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
          <h3 className="text-slate-700 dark:text-slate-300 font-medium mb-2 text-sm">Faixa Etária</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
                <XAxis dataKey="name" tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => {
                  const labels: Record<string, string> = { reach: 'Alcance', leads: 'Leads', clicks: 'Cliques' };
                  return [formatNumber(value), labels[name] || name];
                }} />
                <Bar dataKey="reach" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="leads" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1">
            {ageData.map(a => (
              <div key={a.name} className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{a.name}</span>
                <span>{formatCurrency(a.spend)} | {a.leads} leads</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Regions */}
      {regionData.length > 0 && (
        <div className="bg-white dark:bg-slate-800/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
          <h3 className="text-slate-700 dark:text-slate-300 font-medium mb-2 text-sm">Top Regiões</h3>
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {regionData.map((r, i) => {
              const maxReach = regionData[0]?.reach || 1;
              const pct = (r.reach / maxReach) * 100;
              return (
                <div key={r.region} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-slate-700 dark:text-slate-200 truncate">{r.region}</span>
                      <span className="text-slate-400 ml-2 whitespace-nowrap">{formatNumber(r.reach)} alcance</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                      <span>{formatCurrency(r.spend)}</span>
                      <span>{r.leads} leads | {r.clicks} cliques</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DemographicsChart;
