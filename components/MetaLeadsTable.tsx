import React, { useState, useMemo } from 'react';
import { MetaLeadData } from '../types';
import { Search, Filter, Phone, Mail, MapPin, Calendar } from 'lucide-react';

interface MetaLeadsTableProps {
  leads: MetaLeadData[];
  isDarkMode?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  'Ganho': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Sessão Estratégica Agendada': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Ligação Agendada': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  'Lead Qualificado / Filtro 2': 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'Não qualificada': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Caixa Postal': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const MetaLeadsTable: React.FC<MetaLeadsTableProps> = ({ leads, isDarkMode = true }) => {
  const [search, setSearch] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const campaigns = useMemo(() => {
    const unique = new Set(leads.map(l => l.campaignName).filter(Boolean));
    return Array.from(unique).sort();
  }, [leads]);

  const statuses = useMemo(() => {
    const unique = new Set(leads.map(l => l.pipelineStatus).filter(Boolean));
    return Array.from(unique).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter(lead => {
      const matchSearch = !search ||
        lead.name.toLowerCase().includes(search.toLowerCase()) ||
        lead.email.toLowerCase().includes(search.toLowerCase()) ||
        lead.phone.includes(search);
      const matchCampaign = campaignFilter === 'all' || lead.campaignName === campaignFilter;
      const matchStatus = statusFilter === 'all' || lead.pipelineStatus === statusFilter;
      return matchSearch && matchCampaign && matchStatus;
    });
  }, [leads, search, campaignFilter, statusFilter]);

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full bg-white dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm dark:shadow-none">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-slate-700 dark:text-slate-300 font-medium text-sm">
            Leads Meta Ads ({filtered.length})
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, email ou telefone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <select
            value={campaignFilter}
            onChange={e => setCampaignFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="all">Todas Campanhas</option>
            {campaigns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="all">Todos Status</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 font-medium text-left">Lead</th>
              <th className="sticky top-0 z-10 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 font-medium text-left">Contato</th>
              <th className="sticky top-0 z-10 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 font-medium text-left">Campanha</th>
              <th className="sticky top-0 z-10 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 font-medium text-left">Plataforma</th>
              <th className="sticky top-0 z-10 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 font-medium text-left">Data</th>
              <th className="sticky top-0 z-10 px-4 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 font-medium text-left">Status Pipeline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  {leads.length === 0 ? 'Nenhum lead encontrado na Meta Ads' : 'Nenhum lead corresponde aos filtros'}
                </td>
              </tr>
            ) : (
              filtered.slice(0, 100).map((lead, i) => (
                <tr key={lead.id || i} className="group hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                    <div className="font-medium">{lead.name || '-'}</div>
                    {lead.city && (
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                        <MapPin className="w-3 h-3" /> {lead.city}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                    <div className="space-y-0.5">
                      {lead.email && (
                        <div className="flex items-center gap-1 text-xs">
                          <Mail className="w-3 h-3 text-slate-400" /> {lead.email}
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-1 text-xs">
                          <Phone className="w-3 h-3 text-slate-400" /> {lead.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                    <div className="text-xs">{lead.campaignName || '-'}</div>
                    {lead.adName && <div className="text-xs text-slate-400 mt-0.5">{lead.adName}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200 text-xs">
                    {lead.platform || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                    <div className="flex items-center gap-1 text-xs">
                      <Calendar className="w-3 h-3 text-slate-400" /> {formatDate(lead.createdTime)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {lead.pipelineStatus ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.pipelineStatus] || 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                        {lead.pipelineStatus}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Novo</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > 100 && (
        <div className="p-3 text-center text-xs text-slate-400 border-t border-slate-200 dark:border-slate-700/50">
          Mostrando 100 de {filtered.length} leads
        </div>
      )}
    </div>
  );
};

export default MetaLeadsTable;
