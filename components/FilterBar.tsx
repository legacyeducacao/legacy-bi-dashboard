
import React, { useState } from 'react';
import { Filter, Calendar, User, ShoppingBag, Share2, Globe, ChevronDown, X, SlidersHorizontal, CheckCircle2, ArrowRight } from 'lucide-react';
import { FilterState, FilterOptions } from '../types';

interface FilterBarProps {
  filters: FilterState;
  options: FilterOptions;
  onFilterChange: (key: keyof FilterState, value: string) => void;
  visibleFilters: {
    period?: boolean;
    sdr?: boolean;
    closer?: boolean;
    channel?: boolean;
    product?: boolean;
    source?: boolean;
  };
}

interface SelectWrapperProps {
  icon: any;
  value: string;
  onChange: (val: string) => void;
  label: string;
  children: React.ReactNode;
}

const SelectWrapper: React.FC<SelectWrapperProps> = ({
  icon: Icon,
  value,
  onChange,
  label,
  children
}) => (
  <div className="relative group w-full">
    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors pointer-events-none">
      <Icon size={16} />
    </div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl py-3 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all cursor-pointer"
    >
      {children}
    </select>
    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
      <ChevronDown size={14} />
    </div>
    <label className="absolute -top-2.5 left-3 px-1.5 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-500 dark:text-slate-400 group-focus-within:text-brand-primary transition-colors">
      {label}
    </label>
  </div>
);

const FilterBar: React.FC<FilterBarProps> = ({ filters, options, onFilterChange, visibleFilters }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const hasActiveFilters =
    filters.period !== 'this_month' ||
    filters.sdrId !== 'all' ||
    filters.closerId !== 'all' ||
    filters.channel !== 'all' ||
    filters.product !== 'all' ||
    filters.source !== 'all';

  const resetFilters = () => {
    onFilterChange('period', 'this_month');
    onFilterChange('customStartDate', '');
    onFilterChange('customEndDate', '');
    onFilterChange('sdrId', 'all');
    onFilterChange('closerId', 'all');
    onFilterChange('channel', 'all');
    onFilterChange('product', 'all');
    onFilterChange('source', 'all');
  };

  // Helpers for Labels in Chips
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    // Use string splitting to avoid Time Zone offsets (UTC-3 shift issues)
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}`;
  };

  const getPeriodLabel = (val: string) => {
    const map: Record<string, string> = { 'today': 'Hoje', '7d': '7 dias', '15d': '15 dias', '30d': '30 dias', 'this_month': 'Este Mês', 'custom': 'Personalizado' };

    if (val === 'custom' && filters.customStartDate && filters.customEndDate) {
      return `${formatDate(filters.customStartDate)} - ${formatDate(filters.customEndDate)}`;
    }
    return map[val] || val;
  };

  const getLabel = (key: keyof FilterState, val: string) => {
    if (val === 'all') return null;
    if (key === 'period') return getPeriodLabel(val);
    if (key === 'sdrId') return options.sdrs.find(s => s.id === val)?.name || val;
    if (key === 'closerId') return options.closers.find(c => c.id === val)?.name || val;
    return val;
  };

  return (
    <>
      {/* Summary Bar */}
      <div className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800 py-2 px-4 md:px-6 mb-4 flex items-center justify-between backdrop-blur-sm z-30 relative">

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar mask-gradient-right flex-1">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium mr-1 flex-shrink-0">
            <Filter size={16} />
            <span className="hidden md:inline">Filtros Ativos:</span>
          </div>

          {/* Active Filter Chips */}
          <div className="flex gap-2 items-center">
            {/* Period Chip (Always visible context) */}
            <span className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap flex items-center gap-1.5 ${filters.period !== 'this_month' ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>
              <Calendar size={12} />
              {getPeriodLabel(filters.period)}
            </span>

            {filters.sdrId !== 'all' && visibleFilters.sdr && (
              <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-full text-xs font-medium text-indigo-700 dark:text-indigo-300 whitespace-nowrap flex items-center gap-1.5">
                <User size={12} /> {getLabel('sdrId', filters.sdrId)}
              </span>
            )}
            {filters.closerId !== 'all' && visibleFilters.closer && (
              <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-full text-xs font-medium text-emerald-700 dark:text-emerald-300 whitespace-nowrap flex items-center gap-1.5">
                <User size={12} /> {getLabel('closerId', filters.closerId)}
              </span>
            )}
            {filters.channel !== 'all' && visibleFilters.channel && (
              <span className="px-3 py-1 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-full text-xs font-medium text-blue-700 dark:text-blue-300 whitespace-nowrap flex items-center gap-1.5">
                <Share2 size={12} /> {getLabel('channel', filters.channel)}
              </span>
            )}
            {filters.product !== 'all' && visibleFilters.product && (
              <span className="px-3 py-1 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-full text-xs font-medium text-amber-700 dark:text-amber-300 whitespace-nowrap flex items-center gap-1.5">
                <ShoppingBag size={12} /> {getLabel('product', filters.product)}
              </span>
            )}
            {filters.source !== 'all' && visibleFilters.source && (
              <span className="px-3 py-1 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30 rounded-full text-xs font-medium text-purple-700 dark:text-purple-300 whitespace-nowrap flex items-center gap-1.5">
                <Globe size={12} /> {getLabel('source', filters.source)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-slate-700/50 flex-shrink-0">
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
              title="Limpar Filtros"
            >
              <X size={18} />
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-primary dark:hover:border-brand-primary text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <SlidersHorizontal size={16} />
            <span className="hidden md:inline">Configurar</span>
          </button>
        </div>
      </div>

      {/* Filter Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          {/* Modal Content */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <div className="p-1.5 bg-brand-primary/10 rounded-lg text-brand-primary">
                  <SlidersHorizontal size={20} />
                </div>
                Filtrar Dados
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto">

              {/* Period - Always visible */}
              {visibleFilters.period && (
                <div className="space-y-3">
                  <SelectWrapper icon={Calendar} label="Período de Análise" value={filters.period} onChange={(val) => onFilterChange('period', val)}>
                    <option value="today">Hoje</option>
                    <option value="7d">Últimos 7 dias</option>
                    <option value="15d">Últimos 15 dias</option>
                    <option value="30d">Últimos 30 dias</option>
                    <option value="this_month">Este Mês (Atual)</option>
                    <option value="custom">Personalizado (Selecionar Datas)</option>
                  </SelectWrapper>

                  {/* Custom Date Pickers */}
                  {filters.period === 'custom' && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 pl-1">Data Início</label>
                        <input
                          type="date"
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                          value={filters.customStartDate || ''}
                          onChange={(e) => onFilterChange('customStartDate', e.target.value)}
                        />
                      </div>
                      <div className="pt-5 text-slate-400">
                        <ArrowRight size={16} />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 pl-1">Data Fim</label>
                        <input
                          type="date"
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                          value={filters.customEndDate || ''}
                          onChange={(e) => onFilterChange('customEndDate', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-5">
                {visibleFilters.sdr && (
                  <SelectWrapper icon={User} label="SDR / Pré-Vendas" value={filters.sdrId} onChange={(val) => onFilterChange('sdrId', val)}>
                    <option value="all">Todos os SDRs</option>
                    {options.sdrs.map(sdr => <option key={sdr.id} value={sdr.id}>{sdr.name}</option>)}
                  </SelectWrapper>
                )}

                {visibleFilters.closer && (
                  <SelectWrapper icon={User} label="Closer / Vendedor" value={filters.closerId} onChange={(val) => onFilterChange('closerId', val)}>
                    <option value="all">Todos os Closers</option>
                    {options.closers.map(closer => <option key={closer.id} value={closer.id}>{closer.name}</option>)}
                  </SelectWrapper>
                )}

                {visibleFilters.channel && (
                  <SelectWrapper icon={Share2} label="Canal de Tração" value={filters.channel} onChange={(val) => onFilterChange('channel', val)}>
                    <option value="all">Todos os Canais</option>
                    {options.channels.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                  </SelectWrapper>
                )}

                {visibleFilters.product && (
                  <SelectWrapper icon={ShoppingBag} label="Produto" value={filters.product} onChange={(val) => onFilterChange('product', val)}>
                    <option value="all">Todos os Produtos</option>
                    {options.products.map(prod => <option key={prod} value={prod}>{prod}</option>)}
                  </SelectWrapper>
                )}

                {visibleFilters.source && (
                  <SelectWrapper icon={Globe} label="Origem do Lead" value={filters.source} onChange={(val) => onFilterChange('source', val)}>
                    <option value="all">Todas as Origens</option>
                    {options.sources.map(src => <option key={src} value={src}>{src}</option>)}
                  </SelectWrapper>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="px-4 py-2 text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                >
                  Limpar Tudo
                </button>
              )}
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-lg font-medium transition-colors shadow-lg shadow-brand-primary/20 flex items-center gap-2"
              >
                <CheckCircle2 size={16} />
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FilterBar;
