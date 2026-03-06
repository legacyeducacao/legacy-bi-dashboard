import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Megaphone,
  Headset,
  Banknote,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Play,
  Maximize2,
  Menu,
  X,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  BrainCircuit,
  BarChart2,
  AlertCircle,
  Presentation, // Icon for Board
  Box, // Icon for Products
  Share2, // Icon for Channels
  Trophy,
  Zap,
  Clock,
  UserCheck,
  Target,
  Award, // Replaced Podium
  RefreshCcw,
  Loader2
} from 'lucide-react';
import LogoDark from './imgs/Logo-Dark.svg';
import LogoLight from './imgs/Logo-Light.svg';
import ColapsedLogoDark from './imgs/Colapsed-logo-dark.svg';
import ColapsedLogoLight from './imgs/Colapsed-logo-light.svg';
import MetricCard from './components/MetricCard';
import { FunnelChart, TrendChart, GoalAchievementChart, MicroChart, DonutChart } from './components/Charts';
import DataTable from './components/DataTable';
import RankingWidget from './components/RankingWidget';
import Whiteboard from './components/Whiteboard';
import FilterBar from './components/FilterBar';
import { SkeletonMetricCard, SkeletonChart, SkeletonTable, SkeletonRankingWidget, SkeletonAnalysis, Skeleton } from './components/SkeletonLoader';
import { fetchDashboardData, DashboardData, uploadMarketingSector, uploadCommercialSector, uploadGoalsSector, triggerMetaAdsAutomation, updateKPIGoals } from './services/api';
import { formatValue, calculatePace } from './utils/calculations';
import { parseCSV } from './utils/csvParser';
import { RepPerformance, AppSettings, MetricData, MarketingChannelStats, MarketingProductStats, MarketingCampaignStats, FilterState, FilterOptions, PaceAnalysis } from './types';

// Tab Enum
enum Tab {
  OVERVIEW = 'overview',
  MARKETING = 'marketing',
  SDR = 'sdr',
  SALES = 'sales',
  RANKING = 'ranking', // New Tab
  BOARD = 'board',
  ANALYSIS = 'analysis',
}

// Order for Auto-Rotate
const TAB_ORDER = [Tab.OVERVIEW, Tab.MARKETING, Tab.SDR, Tab.SALES, Tab.RANKING, Tab.ANALYSIS];

const TAB_TITLES = {
  [Tab.OVERVIEW]: 'Visão Geral',
  [Tab.ANALYSIS]: 'Diagnóstico da Operação',
  [Tab.MARKETING]: 'Marketing (Macro & Micro)',
  [Tab.SDR]: 'Comercial: Pré-Vendas (SDR)',
  [Tab.SALES]: 'Comercial: Fechamento (Closer)',
  [Tab.RANKING]: 'Hall da Fama (Rankings)',
  [Tab.BOARD]: 'Board & Estratégia'
};

const App: React.FC = () => {
  // --- State ---
  const [activeTab, setActiveTab] = useState<Tab>(Tab.OVERVIEW);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'data' | 'goals'>('general');

  // Marketing Micro View Toggle State
  const [microView, setMicroView] = useState<'channels' | 'products'>('channels');

  // Data State
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    kpis: {},
    dailyTrends: [],
    sdrData: [],
    closerData: [],
    channels: [],
    products: [],
    context: { currentDay: 1, totalDays: 30 },
    funnelData: [],
    rawMarketingData: [],
    lastUpdated: new Date()
  });

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    period: 'this_month',
    customStartDate: '',
    customEndDate: '',
    sdrId: 'all',
    closerId: 'all',
    channel: 'all',
    product: 'all',
    source: 'all'
  });

  // Settings State
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark', // Default to dark
    autoRotate: false,
    tabDurations: {
      [Tab.OVERVIEW]: 60,
      [Tab.ANALYSIS]: 60,
      [Tab.MARKETING]: 60,
      [Tab.SDR]: 60,
      [Tab.SALES]: 60,
      [Tab.RANKING]: 60,
      [Tab.BOARD]: 60
    }
  });

  // --- Fetch Data ---
  // Manual Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // --- New Goals State ---
  const [tempGoals, setTempGoals] = useState<Record<string, number>>({});

  // Sync tempGoals when settings opens
  useEffect(() => {
    if (showSettings && data.kpis) {
      const goals: Record<string, number> = {};
      Object.keys(data.kpis).forEach(key => {
        goals[key] = data.kpis[key].goal;
      });
      setTempGoals(goals);
    }
  }, [showSettings, data.kpis]);

  // --- Handlers ---
  const handleSaveGoals = async () => {
    setIsUploading(true);
    setUploadStatus(null);
    try {
      const kpisToUpdate = Object.entries(tempGoals).map(([id, goal]) => {
        // Usa o db_id original para fazer o upsert no Supabase
        const kpi = data.kpis[id];
        return {
          id: kpi.db_id || kpi.id || id,
          label: kpi.label, // Inclui label para satisfazer NOT NULL no upsert
          unit: kpi.unit,   // Inclui unit para satisfazer NOT NULL no upsert
          goal
        };
      });
      await updateKPIGoals(kpisToUpdate);
      setUploadStatus({ type: 'success', message: 'Metas atualizadas com sucesso!' });
      loadData();
    } catch (e) {
      setUploadStatus({ type: 'error', message: 'Erro ao atualizar metas.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSectorUpload = async (e: React.ChangeEvent<HTMLInputElement>, sector: 'marketing' | 'commercial') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const text = await file.text();
      const parsedData = parseCSV<any>(text);

      if (parsedData.length === 0) {
        throw new Error("Arquivo vazio ou formato inválido.");
      }

      if (sector === 'marketing') await uploadMarketingSector(parsedData);
      else if (sector === 'commercial') await uploadCommercialSector(parsedData);

      setUploadStatus({ type: 'success', message: `Dados de ${sector.toUpperCase()} sincronizados!` });
      loadData(); // Refresh dashboard
    } catch (err: any) {
      console.error(`Upload error (${sector}):`, err);
      setUploadStatus({ type: 'error', message: err.message || 'Erro ao processar arquivo.' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const loadData = async (triggerSync = false) => {
    setIsLoading(true);

    if (triggerSync) {
      setIsSyncing(true);
      try {
        // 1. Dispara o webhook — o n8n faz fetch do Meta Ads + salva via Postgres
        await triggerMetaAdsAutomation();
        // 2. Aguarda o n8n processar (Meta Ads API + transform + Postgres upsert)
        await new Promise(resolve => setTimeout(resolve, 6000));
        console.log('[Sync] n8n concluído. Buscando dados atualizados...');
      } catch (e) {
        console.error("N8N Sync Error:", e);
      } finally {
        setIsSyncing(false);
      }
    }

    try {
      const dashboardData = await fetchDashboardData();
      setData(dashboardData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };



  useEffect(() => {
    loadData();
  }, []);

  // --- Derived Data for Filters ---
  const filterOptions: FilterOptions = useMemo(() => {
    return {
      sdrs: data.sdrData.map(s => ({ id: s.id, name: s.name })),
      closers: data.closerData.map(c => ({ id: c.id, name: c.name })),
      channels: data.channels.map(c => c.channel),
      products: data.products.map(p => p.product),
      sources: [], // Or derive from another dimension if we build one
    };
  }, [data]);

  // --- Filter Logic ---
  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Determine Visible Filters based on Active Tab
  const visibleFilters = useMemo(() => {
    switch (activeTab) {
      case Tab.OVERVIEW:
        return { period: true, product: true };
      case Tab.MARKETING:
        return { period: true, channel: true, product: true, source: true };
      case Tab.SDR:
        return { period: true, sdr: true, source: true };
      case Tab.SALES:
        return { period: true, closer: true, product: true };
      case Tab.RANKING:
        return { period: true, sdr: true, closer: true };
      case Tab.ANALYSIS:
        return { period: true };
      default:
        return { period: true };
    }
  }, [activeTab]);

  // --- FILTER IMPLEMENTATION ---

  // 1. Filtered Lists (Entities)
  // Helper: filter raw team activities by period
  const filteredRawTeam = useMemo(() => {
    const raw = data.rawTeamData || [];
    if (filters.period === 'today') {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      return raw.filter((r: any) => r.date === todayStr);
    }
    if (filters.period === 'this_month') {
      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return raw.filter((r: any) => r.date >= startOfMonth);
    }
    if (filters.period === 'custom' && filters.customStartDate && filters.customEndDate) {
      return raw.filter((r: any) => r.date >= filters.customStartDate && r.date <= filters.customEndDate);
    }
    // For 7d, 15d, 30d
    let days = 30;
    if (filters.period === '7d') days = 7;
    else if (filters.period === '15d') days = 15;

    const now = new Date();
    now.setDate(now.getDate() - days);
    const cutoff = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return raw.filter((r: any) => r.date >= cutoff);
  }, [data.rawTeamData, filters.period, filters.customStartDate, filters.customEndDate]);

  // 1. Filtered Lists (Entities)
  const filteredSDRs = useMemo(() => {
    const teamMap = new Map<string, any>();
    filteredRawTeam.forEach((r: any) => {
      const repName = r.dim_team?.name || r.rep_name || 'Sem_Dono';
      const role = r.dim_team?.role || r.role || 'SDR';
      if (!teamMap.has(repName)) {
        teamMap.set(repName, { id: repName.replace(/\s+/g, ''), name: repName, role, opportunities: 0, connections: 0, meetingsBooked: 0, meetingsHeld: 0, no_shows: 0, responseTimeSum: 0, responseTimeCount: 0 });
      }
      const t = teamMap.get(repName);
      t.opportunities += Number(r.opportunities) || 0;
      t.connections += Number(r.connections) || 0;
      t.meetingsBooked += Number(r.meetings_booked) || 0;
      t.meetingsHeld += Number(r.meetings_held) || 0;
      t.no_shows += Number(r.no_shows) || 0;
      t.responseTimeSum += Number(r.response_time_sum) || 0;
      t.responseTimeCount += Number(r.response_time_count) || 0;
    });

    const arr = Array.from(teamMap.values())
      .filter((r: any) => {
        const nm = String(r.name).toUpperCase();
        return nm !== 'SISTEMA_APOIO' && nm !== 'SISTEMA APOIO' && String(r.role).toUpperCase() === 'SDR';
      })
      .map((r: any) => ({
        id: r.id, name: r.name, role: 'SDR' as const, opportunities: r.opportunities, connections: r.connections, meetingsBooked: r.meetingsBooked, meetingsHeld: r.meetingsHeld, noShowCount: r.no_shows || Math.max(0, r.meetingsBooked - r.meetingsHeld), responseTime: r.responseTimeCount > 0 ? (r.responseTimeSum / r.responseTimeCount) : 0
      }));

    return arr.filter(s => filters.sdrId === 'all' || s.id === filters.sdrId);
  }, [filteredRawTeam, filters.sdrId]);

  const filteredClosers = useMemo(() => {
    const teamMap = new Map<string, any>();
    filteredRawTeam.forEach((r: any) => {
      const repName = r.dim_team?.name || r.rep_name || 'Sem_Dono';
      const role = r.dim_team?.role || r.role || 'SDR';
      if (!teamMap.has(repName)) {
        teamMap.set(repName, { id: repName.replace(/\s+/g, ''), name: repName, role, sales: 0, revenue: 0, meetingsBooked: 0, meetingsHeld: 0, no_shows: 0 });
      }
      const t = teamMap.get(repName);
      t.sales += Number(r.sales) || 0;
      t.revenue += Number(r.revenue) || 0;
      t.meetingsBooked += Number(r.meetings_booked) || 0;
      t.meetingsHeld += Number(r.meetings_held) || 0;
      t.no_shows += Number(r.no_shows) || 0;
    });

    const arr = Array.from(teamMap.values())
      .filter((r: any) => {
        const nm = String(r.name).toUpperCase();
        return nm !== 'SISTEMA_APOIO' && nm !== 'SISTEMA APOIO' && String(r.role).toUpperCase() === 'CLOSER';
      })
      .map((r: any) => ({
        id: r.id, name: r.name, role: 'Closer' as const, sales: r.sales, revenue: r.revenue, meetingsBooked: r.meetingsBooked, meetingsHeld: r.meetingsHeld, noShowCount: r.no_shows || Math.max(0, r.meetingsBooked - r.meetingsHeld)
      }));

    return arr.filter(c => filters.closerId === 'all' || c.id === filters.closerId);
  }, [filteredRawTeam, filters.closerId]);

  // Helper: aplica o mesmo filtro de período de filteredTrends nos dados raw por canal/produto
  const filteredRawMarketing = useMemo(() => {
    const raw = data.rawMarketingData || [];
    if (filters.period === 'today') {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      return raw.filter((r: any) => r.date === todayStr);
    }
    if (filters.period === 'this_month') {
      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return raw.filter((r: any) => r.date >= startOfMonth);
    }
    if (filters.period === 'custom' && filters.customStartDate && filters.customEndDate) {
      return raw.filter((r: any) => r.date >= filters.customStartDate && r.date <= filters.customEndDate);
    }
    // Períodos fixos: 7d, 15d, 30d
    const days = filters.period === '7d' ? 7 : filters.period === '15d' ? 15 : filters.period === '30d' ? 30 : raw.length;
    const dates = [...new Set(raw.map((r: any) => r.date))].sort().slice(-days) as string[];
    const dateSet = new Set(dates);
    return raw.filter((r: any) => dateSet.has(r.date));
  }, [data.rawMarketingData, filters.period, filters.customStartDate, filters.customEndDate]);

  const filteredChannels = useMemo(() => {
    // Agrupa filteredRawMarketing por canal, somando métricas
    const map = new Map<string, any>();
    filteredRawMarketing.forEach((row: any) => {
      const key = row.channel;
      if (filters.channel !== 'all' && row.channel !== filters.channel) return;
      if (!map.has(key)) {
        map.set(key, { channel: key, investment: 0, leads: 0, mqls: 0, revenue: 0, sales: 0, roas: 0, cpl: 0, cac: 0, impressions: 0, clicks: 0, cpm: 0, ctr: 0 });
      }
      const entry = map.get(key);
      entry.investment += row.cost || 0;
      entry.leads += row.leads || 0;
      entry.mqls += row.mqls || 0;
      entry.revenue += row.revenue || 0;
      entry.sales += row.sales || 0;
      entry.impressions += row.impressions || 0;
      entry.clicks += row.clicks || 0;
    });
    // Calcula métricas derivadas
    return Array.from(map.values()).map(c => ({
      ...c,
      cpl: c.leads > 0 ? c.investment / c.leads : 0,
      cac: c.sales > 0 ? c.investment / c.sales : 0,
      roas: c.investment > 0 ? c.revenue / c.investment : 0,
      cpm: c.impressions > 0 ? (c.investment / c.impressions) * 1000 : 0,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
    }));
  }, [filteredRawMarketing, filters.channel]);

  const filteredCampaigns = useMemo(() => {
    // Agrupa filteredRawMarketing por campanha (Focando em Meta Ads conforme solicitado)
    const map = new Map<string, any>();
    filteredRawMarketing.forEach((row: any) => {
      if (row.channel !== 'Meta Ads (Insta/FB)' && row.channel !== 'Meta Ads') return;
      const key = row.campaign || 'Diversos';
      if (!map.has(key)) {
        map.set(key, { campaign: key, investment: 0, leads: 0, mqls: 0, sales: 0, cpl: 0, cac: 0, roas: 0, revenue: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0 });
      }
      const entry = map.get(key);
      entry.investment += row.cost || 0;
      entry.leads += row.leads || 0;
      entry.mqls += row.mqls || 0;
      entry.sales += row.sales || 0;
      entry.revenue += row.revenue || 0;
      entry.impressions += row.impressions || 0;
      entry.clicks += row.clicks || 0;
    });

    return Array.from(map.values())
      .filter(c => c.campaign !== 'Diversos')
      .map(c => ({
        ...c,
        cpl: c.leads > 0 ? c.investment / c.leads : 0,
        cpl_mql: c.mqls > 0 ? c.investment / c.mqls : 0,
        cac: c.sales > 0 ? c.investment / c.sales : 0,
        roas: c.investment > 0 ? c.revenue / c.investment : 0,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpc: c.clicks > 0 ? c.investment / c.clicks : 0,
      })).sort((a, b) => b.investment - a.investment);
  }, [filteredRawMarketing]);

  const filteredProducts = useMemo(() => {
    // Agrupa filteredRawMarketing por produto, somando métricas
    const map = new Map<string, any>();
    filteredRawMarketing.forEach((row: any) => {
      const key = row.product;
      if (filters.product !== 'all' && row.product !== filters.product) return;
      if (!map.has(key)) {
        map.set(key, { product: key, investment: 0, leads: 0, mqls: 0, revenue: 0, sales: 0, roas: 0 });
      }
      const entry = map.get(key);
      entry.investment += row.cost || 0;
      entry.leads += row.leads || 0;
      entry.mqls += row.mqls || 0;
    });
    return Array.from(map.values()).map(p => ({
      ...p,
      roas: p.investment > 0 ? p.revenue / p.investment : 0,
    }));
  }, [filteredRawMarketing, filters.product]);



  // 2. Filtered Trends (Date Range)
  const filteredTrends = useMemo(() => {
    let days = data.dailyTrends.length;

    if (filters.period === 'today') {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      return data.dailyTrends.filter(t => t.date === todayStr);
    }

    if (filters.period === 'this_month') {
      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return data.dailyTrends.filter(t => t.date >= startOfMonth);
    }

    if (filters.period === 'custom' && filters.customStartDate && filters.customEndDate) {
      return data.dailyTrends.filter(t => t.date >= filters.customStartDate && t.date <= filters.customEndDate);
    }

    days = data.dailyTrends.length;
    if (filters.period === '7d') days = 7;
    else if (filters.period === '15d') days = 15;
    else if (filters.period === '30d') days = 30;

    return data.dailyTrends.slice(-Math.min(days, data.dailyTrends.length));
  }, [filters.period, filters.customStartDate, filters.customEndDate, data.dailyTrends]);

  // 3. Dynamic KPIs (Recalculate global metrics based on active filters)
  const activeKPIs = useMemo(() => {
    // Start with the base global KPIs
    const newKPIs = JSON.parse(JSON.stringify(data.kpis));
    // Aggregation is ALWAYS required to ensure real-time data reflecting current database state

    // Helper: Sum array values
    const sum = (arr: any[], key: string) => arr.reduce((acc, curr) => acc + (curr[key] || 0), 0);
    const avg = (arr: any[], key: string) => arr.length > 0 ? sum(arr, key) / arr.length : 0;

    // Helper to safely initialize KPI objects if they don't exist yet
    const safeKpi = (key: string, label: string, unit: 'currency' | 'number' | 'percentage' | 'time') => {
      if (!newKPIs[key]) {
        newKPIs[key] = { id: key, label, value: 0, goal: 0, unit };
      } else {
        newKPIs[key].unit = unit;
      }
      return newKPIs[key];
    };

    // 1. ALWAYS update base metrics from filteredTrends values to ensure real-time aggregation
    safeKpi('investment', 'Investimento', 'currency').value = sum(filteredTrends, 'investment');
    safeKpi('leads', 'Leads', 'number').value = sum(filteredTrends, 'leads');
    safeKpi('revenue', 'Faturamento MKT', 'currency').value = sum(filteredTrends, 'revenue');
    safeKpi('sales', 'Vendas MKT', 'number').value = sum(filteredTrends, 'sales');
    safeKpi('mqls', 'MQLs', 'number').value = sum(filteredTrends, 'mqls');
    safeKpi('connections', 'Conexões', 'number').value = sum(filteredTrends, 'connections');
    safeKpi('opportunities', 'Oportunidades', 'number').value = sum(filteredTrends, 'opportunities');
    safeKpi('meetingsBooked', 'Reuniões Agendadas', 'number').value = sum(filteredTrends, 'meetings_booked');
    safeKpi('meetingsHeld', 'Reuniões Realizadas', 'number').value = sum(filteredTrends, 'meetings_held');

    // Calculate derived metrics
    if (newKPIs.leads.value > 0) safeKpi('cpl', 'CPL', 'currency').value = newKPIs.investment.value / newKPIs.leads.value;
    if (newKPIs.mqls.value > 0) safeKpi('cpmql', 'Custo por MQL', 'currency').value = newKPIs.investment.value / newKPIs.mqls.value;
    if (newKPIs.sales.value > 0) safeKpi('ticket', 'Ticket Médio', 'currency').value = newKPIs.revenue.value / newKPIs.sales.value;
    if (newKPIs.investment.value > 0) safeKpi('roas', 'ROAS', 'number').value = newKPIs.revenue.value / newKPIs.investment.value;
    if (newKPIs.sales.value > 0) safeKpi('cac', 'CAC', 'currency').value = newKPIs.investment.value / newKPIs.sales.value;

    // Macro Marketing Additions (CPM/CTR)
    const totalImpressions = sum(filteredTrends, 'impressions') || sum(filteredChannels, 'impressions') || 0;
    const totalClicks = sum(filteredTrends, 'clicks') || sum(filteredChannels, 'clicks') || 0;

    // Inject dynamic CPM and CTR into newKPIs (will be used in MarketingView)
    newKPIs.cpmMacro = {
      id: "cpm_macro",
      label: "CPM MACRO",
      value: totalImpressions > 0 ? (newKPIs.investment.value / totalImpressions) * 1000 : 0,
      goal: 0,
      unit: "currency"
    };
    newKPIs.ctrMacro = {
      id: "ctr_macro",
      label: "CTR MACRO",
      value: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      goal: 0,
      unit: "percentage"
    };

    // Calculate No-Show Rate globally (Meetings Booked - Meetings Held)
    const totalBooked = sum(filteredTrends, 'meetings_booked') || sum(filteredSDRs, 'meetingsBooked') || 0;
    const totalHeld = sum(filteredTrends, 'meetings_held') || sum(filteredClosers, 'meetingsHeld') || 0;
    safeKpi('noShowRate', 'Taxa de No-Show', 'percentage').value = totalBooked > 0 ? (Math.max(0, totalBooked - totalHeld) / totalBooked) * 100 : 0;
    safeKpi('conversionMeetingSale', 'Conversão (Agendado -> Venda)', 'percentage').value = totalHeld > 0 ? (newKPIs.sales.value / totalHeld) * 100 : 0;
    safeKpi('responseTime', 'Tempo de Resposta', 'time').value = avg(filteredSDRs, 'responseTime');

    // Apply SDR Filter logic to KPIs
    if (filters.sdrId !== 'all') {
      newKPIs.opportunities.value = sum(filteredSDRs, 'opportunities');
      newKPIs.connections.value = sum(filteredSDRs, 'connections');
      newKPIs.meetingsBooked.value = sum(filteredSDRs, 'meetingsBooked');
      newKPIs.responseTime.value = avg(filteredSDRs, 'responseTime');
      // Goal scaling (simple heuristic: divide goal by number of total reps? or keep global? keeping global goal usually shows how much this rep contributes)
    }

    // Apply Closer Filter logic to KPIs
    safeKpi('marketingSales', 'Vendas MKT', 'number');
    safeKpi('marketingRevenue', 'Faturamento MKT', 'currency');
    safeKpi('salesInbound', 'Vendas Inbound', 'number');
    safeKpi('salesOutbound', 'Vendas Outbound', 'number');

    if (filters.closerId !== 'all') {
      safeKpi('meetingsHeld', 'Reuniões Realizadas', 'number').value = sum(filteredClosers, 'meetingsHeld');
      safeKpi('sales', 'Vendas', 'number').value = sum(filteredClosers, 'sales');
      safeKpi('revenue', 'Faturamento', 'currency').value = sum(filteredClosers, 'revenue');
      // Recalculate derived metrics
      if (newKPIs.sales.value > 0) {
        safeKpi('ticket', 'Ticket Médio', 'currency').value = newKPIs.revenue.value / newKPIs.sales.value;
      }
    }

    // Apply Channel/Product Filter to KPIs (Marketing View)
    if (filters.channel !== 'all' || filters.product !== 'all') {
      // Decide source: if product filter active, use products, else use channels
      const sourceData = filters.product !== 'all' ? filteredProducts : filteredChannels;

      safeKpi('investment', 'Investimento', 'currency').value = sum(sourceData, 'investment');
      safeKpi('leads', 'Leads', 'number').value = sum(sourceData, 'leads');

      // Recalculate CPL
      if (newKPIs.leads.value > 0) {
        safeKpi('cpl', 'CPL', 'currency').value = newKPIs.investment.value / newKPIs.leads.value;
      }

      if (filters.channel !== 'all') {
        safeKpi('mqls', 'MQLs', 'number').value = sum(filteredChannels, 'mqls');
      }

      // If we are filtering by channel/product, revenue/sales might imply marketing attribution
      safeKpi('marketingRevenue', 'Faturamento MKT', 'currency').value = sum(sourceData, 'revenue');
      safeKpi('marketingSales', 'Vendas MKT', 'number').value = sum(sourceData, 'sales');

      // ROAS
      if (newKPIs.investment.value > 0) {
        safeKpi('roas', 'ROAS', 'number').value = newKPIs.marketingRevenue.value / newKPIs.investment.value;
      }
    } else {
      // DEFAULT: When no marketing-specific filter is applied, use global commercial values
      // as the "Marketing" baseline for consistency, as requested by the user.
      safeKpi('marketingSales', 'Vendas MKT', 'number').value = newKPIs.sales?.value || 0;
      safeKpi('marketingRevenue', 'Faturamento MKT', 'currency').value = newKPIs.revenue?.value || 0;

      if (newKPIs.investment?.value > 0) {
        safeKpi('roas', 'ROAS', 'number').value = newKPIs.marketingRevenue.value / newKPIs.investment.value;
      }
    }

    // Use assertive Inbound/Outbound counts from our dual-sync pipeline
    safeKpi('salesInbound', 'Vendas Inbound', 'number').value = sum(filteredTrends, 'inbound');
    safeKpi('salesOutbound', 'Vendas Outbound', 'number').value = sum(filteredTrends, 'outbound');

    // Ensure common indicators are always correctly initialized for Display if DB is missing them
    const ensureKPI = (key: string, label: string, unit: any, goal: number) => {
      if (!newKPIs[key]) {
        newKPIs[key] = { id: key, label, value: 0, goal, unit };
      }
    };

    ensureKPI('ticket', 'Ticket Médio', 'currency', 15000);
    ensureKPI('cpl', 'CPL Médio', 'currency', 20);
    ensureKPI('cac', 'CAC Blended', 'currency', 1500);
    ensureKPI('connections', 'Conexões', 'number', 450);
    ensureKPI('meetingsBooked', 'Reuniões Agendadas', 'number', 100);
    ensureKPI('meetingsHeld', 'Reuniões Realizadas', 'number', 85);
    ensureKPI('salesInbound', 'Vendas Inbound', 'number', 15);
    ensureKPI('salesOutbound', 'Vendas Outbound', 'number', 5);

    return newKPIs;
  }, [data.kpis, filters, filteredTrends, filteredSDRs, filteredClosers, filteredChannels, filteredProducts]);

  // --- Effects ---

  // Apply Theme
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Auto Rotation Logic
  useEffect(() => {
    if (!settings.autoRotate) return;

    if (!TAB_ORDER.includes(activeTab)) {
      return;
    }

    const duration = settings.tabDurations[activeTab] || 60; // seconds
    const timer = setTimeout(() => {
      const currentIndex = TAB_ORDER.indexOf(activeTab);
      const nextIndex = (currentIndex + 1) % TAB_ORDER.length;
      setActiveTab(TAB_ORDER[nextIndex]);
    }, duration * 1000);

    return () => clearTimeout(timer);
  }, [activeTab, settings.autoRotate, settings.tabDurations]);

  // --- Handlers ---

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  const updateDuration = (tab: Tab, seconds: number) => {
    setSettings(prev => ({
      ...prev,
      tabDurations: { ...prev.tabDurations, [tab]: seconds }
    }));
  };

  const isDark = settings.theme === 'dark';

  // --- Calculated Goals & Metrics ---
  const dailyLeadsGoal = activeKPIs.leads ? Math.round(activeKPIs.leads.goal / data.context.totalDays) : 0;

  // --- Loading Skeleton View Renderer ---
  const renderLoadingView = () => {
    switch (activeTab) {
      case Tab.OVERVIEW:
        return (
          <div className="flex flex-col h-full gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-shrink-0">
              <SkeletonMetricCard /> <SkeletonMetricCard /> <SkeletonMetricCard /> <SkeletonMetricCard />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
              <SkeletonChart className="lg:col-span-2 h-full" />
              <SkeletonChart className="lg:col-span-1 h-full" />
            </div>
          </div>
        );
      case Tab.ANALYSIS:
        return <SkeletonAnalysis />;
      case Tab.MARKETING:
      case Tab.SDR:
      case Tab.SALES:
        return (
          <div className="flex flex-col h-full gap-4">
            <div className="flex flex-col gap-3 flex-shrink-0">
              <Skeleton className="h-5 w-48 mb-2" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SkeletonMetricCard /> <SkeletonMetricCard /> <SkeletonMetricCard /> <SkeletonMetricCard />
              </div>
            </div>
            <div className="flex flex-col gap-3 flex-1 min-h-0">
              <Skeleton className="h-5 w-48 mb-2" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                <SkeletonChart className="lg:col-span-1 h-full" />
                <SkeletonTable rows={8} />
              </div>
            </div>
          </div>
        );
      case Tab.RANKING:
        return (
          <div className="flex flex-col h-full gap-6">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-5 w-48" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-80">
                <SkeletonRankingWidget /><SkeletonRankingWidget /><SkeletonRankingWidget />
              </div>
            </div>
            <div className="flex flex-col gap-3 mt-4">
              <Skeleton className="h-5 w-48" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-80">
                <SkeletonRankingWidget /><SkeletonRankingWidget /><SkeletonRankingWidget />
              </div>
            </div>
          </div>
        );
      case Tab.BOARD:
        return <Skeleton className="w-full h-full rounded-xl" />;
      default:
        return null;
    }
  };

  // --- Views Components ---

  const OverviewView = () => (
    <div className="flex flex-col h-full gap-6 animate-in fade-in duration-500 overflow-y-auto custom-scrollbar pr-1 pb-6">

      {/* 1. Primary KPIs - Dedicated Row for perfect balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 flex-shrink-0 mb-2">
        {activeKPIs.investment && <MetricCard metric={activeKPIs.investment} context={data.context} inverse />}
        {activeKPIs.revenue && <MetricCard metric={activeKPIs.revenue} context={data.context} />}
        {activeKPIs.roas && <MetricCard metric={activeKPIs.roas} context={data.context} />}
        {activeKPIs.leads && <MetricCard metric={activeKPIs.leads} context={data.context} />}
      </div>

      {/* 2. Marketing & Efficiency Cluster */}
      <div className="bg-slate-50/50 dark:bg-slate-900/10 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/50 flex flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <div className="w-2 h-6 bg-slate-400/50 rounded-full"></div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Marketing & Eficiência</h4>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {activeKPIs.ticket && <div className="h-full"><MetricCard metric={activeKPIs.ticket} context={data.context} variant="compact" /></div>}
          {activeKPIs.cpl && <div className="h-full"><MetricCard metric={activeKPIs.cpl} context={data.context} variant="compact" inverse /></div>}
          {activeKPIs.cac && <div className="h-full"><MetricCard metric={activeKPIs.cac} context={data.context} variant="compact" inverse /></div>}
          {activeKPIs.salesInbound && (
            <div className="h-full">
              <MetricCard
                metric={activeKPIs.salesInbound}
                context={data.context}
                variant="compact"
                customComparison={{
                  label: 'Inbound (Entrada)',
                  value: activeKPIs.sales?.value > 0 ? (activeKPIs.salesInbound.value / activeKPIs.sales.value) * 100 : 0,
                  suffix: '%'
                }}
              />
            </div>
          )}
          {activeKPIs.salesOutbound && (
            <div className="h-full">
              <MetricCard
                metric={activeKPIs.salesOutbound}
                context={data.context}
                variant="compact"
                customComparison={{
                  label: 'Outbound (Ativo)',
                  value: activeKPIs.sales?.value > 0 ? (activeKPIs.salesOutbound.value / activeKPIs.sales.value) * 100 : 0,
                  suffix: '%'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. Unified Commercial Funnel Cluster */}
      <div className="bg-slate-50/50 dark:bg-slate-900/20 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/50 flex flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <div className="w-2 h-6 bg-primary rounded-full"></div>
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Funil Comercial</h4>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {activeKPIs.connections && (
            <div className="h-full">
              <MetricCard
                metric={activeKPIs.connections}
                context={data.context}
                variant="funnel"
                customComparison={{
                  label: 'Taxa Conv.',
                  value: activeKPIs.leads?.value > 0 ? (activeKPIs.connections.value / activeKPIs.leads.value) * 100 : 0,
                  suffix: '%'
                }}
              />
            </div>
          )}
          {activeKPIs.meetingsBooked && (
            <div className="h-full">
              <MetricCard
                metric={activeKPIs.meetingsBooked}
                context={data.context}
                variant="funnel"
                customComparison={{
                  label: 'Taxa Agend.',
                  value: activeKPIs.connections?.value > 0 ? (activeKPIs.meetingsBooked.value / activeKPIs.connections.value) * 100 : 0,
                  suffix: '%'
                }}
              />
            </div>
          )}
          {activeKPIs.meetingsHeld && (
            <div className="h-full">
              <MetricCard
                metric={activeKPIs.meetingsHeld}
                context={data.context}
                variant="funnel"
                customComparison={{
                  label: 'Taxa de Presença',
                  value: activeKPIs.meetingsBooked?.value > 0 ? (activeKPIs.meetingsHeld.value / activeKPIs.meetingsBooked.value) * 100 : 0,
                  suffix: '%'
                }}
              />
            </div>
          )}
          {activeKPIs.sales && (
            <div className="h-full">
              <MetricCard
                metric={activeKPIs.sales}
                context={data.context}
                variant="funnel"
                customComparison={{
                  label: 'Taxa de Fechamento',
                  value: activeKPIs.meetingsHeld?.value > 0 ? (activeKPIs.sales.value / activeKPIs.meetingsHeld.value) * 100 : 0,
                  suffix: '%'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 3. Charts Cluster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[400px]">
        <div className="lg:col-span-2 flex flex-col">
          <GoalAchievementChart
            title="Performance de Faturamento"
            currentData={filteredTrends}
            dataKey="revenue"
            goal={activeKPIs.revenue?.goal || 0}
            totalDays={data.context.totalDays}
            currentDay={data.context.currentDay}
            isDarkMode={isDark}
            className="flex-1"
            unit="currency"
          />
        </div>
        <div className="lg:col-span-1 flex flex-col">
          <FunnelChart
            data={data.funnelData}
            isDarkMode={isDark}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );

  const AnalysisView = () => {
    // 1. Analyze all metrics
    const allMetrics = Object.values(activeKPIs) as MetricData[];

    // Helper to categorize
    const categorized = allMetrics.reduce<{
      critical: { metric: MetricData; analysis: PaceAnalysis; isInverse: boolean }[];
      warning: { metric: MetricData; analysis: PaceAnalysis; isInverse: boolean }[];
      good: { metric: MetricData; analysis: PaceAnalysis; isInverse: boolean }[];
    }>((acc, metric) => {
      if (!metric.goal) return acc;
      const analysis = calculatePace(metric, data.context);
      const isInverse = metric.id === 'cpmql' || metric.id === 'cac' || metric.id === 'cpl' || metric.id === 'response_time' || metric.id === 'no_show_rate';
      let score = analysis.projectionPercent;

      if (isInverse) {
        if (score > 110) score = 70;
        else if (score > 100) score = 85;
        else score = 100;
      }

      if (score < 80) {
        acc.critical.push({ metric, analysis, isInverse });
      } else if (score < 95) {
        acc.warning.push({ metric, analysis, isInverse });
      } else {
        acc.good.push({ metric, analysis, isInverse });
      }
      return acc;
    }, { critical: [], warning: [], good: [] });

    const totalScore = allMetrics.reduce((sum, metric) => {
      if (!metric.goal) return sum + 100;
      const analysis = calculatePace(metric, data.context);
      let p = analysis.projectionPercent;
      if (['cpmql', 'cac', 'cpl', 'response_time', 'no_show_rate'].includes(metric.id)) p = p > 100 ? 100 - (p - 100) : 100 + (100 - p);
      return sum + Math.min(p, 100);
    }, 0);
    const healthScore = allMetrics.length > 0 ? Math.round(totalScore / allMetrics.length) : 0;

    return (
      <div className="flex flex-col h-full gap-6 animate-in fade-in duration-500 overflow-y-auto pr-2">

        {/* Top Section: Health & Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-shrink-0">

          {/* Main Health Card */}
          <div className="lg:col-span-1 bg-gradient-to-br from-brand-primary to-brand-light rounded-xl p-6 shadow-lg text-white relative overflow-hidden flex flex-col justify-between">
            <div className="absolute -right-6 -top-6 text-white/10">
              <Activity size={140} />
            </div>
            <div>
              <h3 className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-1">Saúde da Operação</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-extrabold">{healthScore}%</span>
                <span className="text-sm font-medium opacity-80">Score</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="flex items-center justify-between text-sm">
                <span className="opacity-90">Métricas Críticas</span>
                <span className="bg-white/20 px-2 py-0.5 rounded font-bold">{categorized.critical.length}</span>
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-800/40 rounded-xl p-6 border border-slate-200 dark:border-slate-700/50 flex flex-col justify-center shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-slate-700/50">
              <BrainCircuit className="text-brand-primary w-5 h-5" />
              <h3 className="text-slate-800 dark:text-white font-bold text-sm uppercase tracking-wide">Insights da IA</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex gap-3 items-start">
                <div className={`mt-1 p-1.5 rounded-full flex-shrink-0 ${categorized.critical.length > 0 ? 'bg-rose-100 text-rose-500 dark:bg-rose-500/10' : 'bg-emerald-100 text-emerald-500 dark:bg-emerald-500/10'}`}>
                  {categorized.critical.length > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-0.5">
                    {categorized.critical.length > 0 ? "Atenção Prioritária" : "Ritmo Estável"}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {categorized.critical.length > 0
                      ? `${categorized.critical.map((i) => i.metric.label).slice(0, 2).join(', ')} requerem ajuste de rota imediato.`
                      : "Todas as métricas principais estão dentro da margem de segurança."}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="mt-1 p-1.5 rounded-full flex-shrink-0 bg-brand-primary/10 text-brand-primary">
                  <TrendingUp size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-0.5">Oportunidade</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {(activeKPIs.cpmql?.value || 0) < (activeKPIs.cpmql?.goal || 0)
                      ? "Custo por Lead/MQL abaixo do teto. Possível escalar campanhas sem comprometer margem."
                      : "Considere realocar budget de canais com menor ROAS para estabilizar o CAC."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Board - Minimalist Cards (Critical, Warning, Good) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
          {/* Column 1: Critical */}
          <div className="flex flex-col gap-3">
            <h4 className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest pb-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> Abaixo da Meta
            </h4>
            <div className="space-y-3">
              {categorized.critical.map((item) => (
                <div key={item.metric.id} className="group bg-white dark:bg-slate-800/40 border-l-4 border-l-rose-500 border-y border-r border-slate-200 dark:border-r-slate-700/50 dark:border-y-slate-700/50 p-4 rounded-r-xl shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.metric.label}</span>
                  </div>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-2xl font-bold text-slate-800 dark:text-white">{item.analysis.projectionPercent.toFixed(0)}%</span>
                    <span className="text-xs text-slate-400 mb-1">da meta</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-1 rounded-full overflow-hidden"><div className="h-full bg-rose-500" style={{ width: `${Math.min(item.analysis.projectionPercent, 100)}%` }}></div></div>
                </div>
              ))}
            </div>
          </div>
          {/* Column 2: Warning */}
          <div className="flex flex-col gap-3">
            <h4 className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest pb-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Em Atenção
            </h4>
            <div className="space-y-3">
              {categorized.warning.map((item) => (
                <div key={item.metric.id} className="bg-white dark:bg-slate-800/40 border-l-4 border-l-amber-500 border-y border-r border-slate-200 dark:border-r-slate-700/50 dark:border-y-slate-700/50 p-4 rounded-r-xl shadow-sm">
                  <div className="flex justify-between items-start mb-3"><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.metric.label}</span></div>
                  <div className="flex items-end justify-between mb-2"><span className="text-2xl font-bold text-slate-800 dark:text-white">{item.analysis.projectionPercent.toFixed(0)}%</span></div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-1 rounded-full overflow-hidden"><div className="h-full bg-amber-500" style={{ width: `${Math.min(item.analysis.projectionPercent, 100)}%` }}></div></div>
                </div>
              ))}
            </div>
          </div>
          {/* Column 3: Good */}
          <div className="flex flex-col gap-3">
            <h4 className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest pb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> No Alvo
            </h4>
            <div className="space-y-3">
              {categorized.good.map((item) => (
                <div key={item.metric.id} className="bg-white dark:bg-slate-800/40 border-l-4 border-l-emerald-500 border-y border-r border-slate-200 dark:border-r-slate-700/50 dark:border-y-slate-700/50 p-4 rounded-r-xl shadow-sm">
                  <div className="flex justify-between items-start mb-3"><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.metric.label}</span></div>
                  <div className="flex items-end justify-between mb-2"><span className="text-2xl font-bold text-slate-800 dark:text-white">{item.analysis.projectionPercent.toFixed(0)}%</span></div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-1 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(item.analysis.projectionPercent, 100)}%` }}></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const MarketingView = () => (
    <div className="flex flex-col h-full gap-6 animate-in fade-in duration-500 overflow-y-auto pr-2">
      {/* Macro */}
      <div className="flex flex-col gap-3 flex-shrink-0">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-l-4 border-brand-primary pl-2">
          Macro Estratégia
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeKPIs.investment && <MetricCard metric={activeKPIs.investment} context={data.context} />}
          {activeKPIs.leads && (
            <MetricCard
              metric={activeKPIs.leads}
              context={data.context}
              customComparison={{ value: activeKPIs.cpl?.value || 0, label: 'CPL Médio', unit: 'currency' }}
            />
          )}
          {activeKPIs.cpmMacro && (
            <MetricCard
              metric={activeKPIs.cpmMacro}
              context={data.context}
            />
          )}
          {activeKPIs.ctrMacro && (
            <MetricCard
              metric={activeKPIs.ctrMacro}
              context={data.context}
            />
          )}
        </div>
      </div>

      {/* Micro */}
      <div className="flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex justify-between items-end pb-1 border-b border-slate-200 dark:border-slate-700/50">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-l-4 border-emerald-500 pl-2">
            Análise Micro
          </h3>
          <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
            <button onClick={() => setMicroView('channels')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${microView === 'channels' ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
              <Share2 className="w-3.5 h-3.5" /> Canais de Tração
            </button>
            <button onClick={() => setMicroView('products')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${microView === 'products' ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
              <Box className="w-3.5 h-3.5" /> Produtos
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
          <div className="lg:col-span-1 h-full min-h-0">
            <TrendChart
              title={microView === 'channels' ? "Evolução de Leads (30d)" : "Evolução de Vendas (30d)"}
              data={filteredTrends}
              dataKeyBar={microView === 'channels' ? "leads" : "sales"}
              isDarkMode={isDark}
              className="h-full"
              targetValue={microView === 'channels' ? dailyLeadsGoal : undefined}
              unit="number"
            />
          </div>
          <div className="lg:col-span-2 h-full min-h-0 overflow-hidden flex flex-col">
            <div className="flex-1 animate-in fade-in duration-300 flex flex-col gap-6 overflow-hidden">
              {microView === 'channels' ? (
                <>
                  <div className="flex-shrink-0 pb-1">
                    <DataTable<MarketingChannelStats>
                      title="Performance por Canal"
                      data={[...filteredChannels].sort((a, b) => b.investment - a.investment)}
                      columns={[
                        { header: 'Canal / Origem', accessor: (row) => <span className="font-semibold text-slate-800 dark:text-white">{row.channel}</span> },
                        { header: 'Investimento', accessor: (row) => formatValue(row.investment, 'currency'), align: 'right' },
                        { header: 'Leads', accessor: (row) => row.leads, align: 'right' },
                        { header: 'CPL', accessor: (row) => formatValue(row.cpl, 'currency'), align: 'right' },
                        { header: 'CPM', accessor: (row) => formatValue(row.cpm, 'currency'), align: 'right' },
                        { header: 'CTR', accessor: (row) => `${row.ctr.toFixed(2)}%`, align: 'right' },
                        { header: 'CAC', accessor: (row) => formatValue(row.cac, 'currency'), align: 'right' },
                        { header: 'ROAS', accessor: (row) => <span className={row.roas > 10 ? 'text-emerald-500 font-bold' : ''}>{row.roas.toFixed(1)}x</span>, align: 'right' },
                      ]}
                    />
                  </div>

                  {filteredCampaigns.length > 0 && (
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800/30">
                      <DataTable<MarketingCampaignStats>
                        title="Performance de Campanhas (Meta Ads)"
                        data={filteredCampaigns}
                        showBorder={false}
                        columns={[
                          { header: 'Campanha', accessor: (row) => <span className="font-semibold text-slate-800 dark:text-white">{row.campaign}</span> },
                          { header: 'Investimento', accessor: (row) => formatValue(row.investment, 'currency'), align: 'right' },
                          { header: 'Cliques', accessor: (row) => row.clicks, align: 'right' },
                          { header: 'CPC', accessor: (row) => formatValue(row.cpc, 'currency'), align: 'right' },
                          { header: 'CTR', accessor: (row) => `${row.ctr.toFixed(2)}%`, align: 'right' },
                          { header: 'Leads', accessor: (row) => row.campaign.toLowerCase().includes('nativo') ? '-' : row.leads, align: 'right' },
                          { header: 'MQLs', accessor: (row) => row.mqls, align: 'right' },
                          { header: 'CPL (MQL)', accessor: (row) => formatValue((row as any).cpl_mql, 'currency'), align: 'right' },
                          { header: 'CPL', accessor: (row) => formatValue(row.cpl, 'currency'), align: 'right' },
                          { header: 'ROAS', accessor: (row) => <span className={row.roas > 10 ? 'text-emerald-500 font-bold' : ''}>{row.roas.toFixed(1)}x</span>, align: 'right' },
                        ]}
                      />
                    </div>
                  )}
                </>
              ) : (
                <DataTable<MarketingProductStats>
                  title="Performance por Produto"
                  data={[...filteredProducts].sort((a, b) => b.investment - a.investment)}
                  columns={[
                    { header: 'Produto', accessor: (row) => <span className="font-semibold text-brand-primary dark:text-brand-light">{row.product}</span> },
                    { header: 'Investimento', accessor: (row) => formatValue(row.investment, 'currency'), align: 'right' },
                    { header: 'Vendas', accessor: (row) => row.sales, align: 'right' },
                    { header: 'Receita', accessor: (row) => formatValue(row.revenue, 'currency'), align: 'right' },
                    { header: 'ROAS', accessor: (row) => <span className={row.roas > 10 ? 'text-emerald-500 font-bold' : ''}>{row.roas.toFixed(1)}x</span>, align: 'right' },
                  ]}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const SdrView = () => (
    <div className="flex flex-col h-full gap-4 animate-in fade-in duration-500 overflow-y-auto pr-2">

      {/* 3.3.1 Comercial Macro (SDR Focus) */}
      <div className="flex flex-col gap-3 flex-shrink-0">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-l-4 border-indigo-500 pl-2">
          Comercial Macro (Pré-Vendas)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeKPIs.opportunities && <MetricCard metric={activeKPIs.opportunities} context={data.context} />}
          {activeKPIs.connections && <MetricCard metric={activeKPIs.connections} context={data.context} />}
          {activeKPIs.meetingsBooked && <MetricCard metric={activeKPIs.meetingsBooked} context={data.context} />}
          {activeKPIs.responseTime && <MetricCard metric={activeKPIs.responseTime} context={data.context} inverse showPace={false} customComparison={{ value: 15, label: 'SLA Máximo (min)' }} />}
        </div>
      </div>

      {/* 3.3.2 Comercial Micro (Pace Chart + Trends) */}
      <div className="flex flex-col gap-3 flex-1 min-h-0">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-l-4 border-blue-500 pl-2">
          Análise Micro: Ritmo & Atividades
        </h3>
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6 pb-4">

          {/* Goal Achievement Chart (Revenue Context for SDR) */}
          <div className="h-full min-h-[300px]">
            <GoalAchievementChart
              title="Atingimento de Meta (Ritmo) - Faturamento"
              currentData={filteredTrends}
              dataKey="revenue"
              goal={activeKPIs.revenue?.goal || 0}
              totalDays={data.context.totalDays}
              currentDay={data.context.currentDay}
              isDarkMode={isDark}
              className="h-full"
              unit="currency"
            />
          </div>

          {/* SDR Activity Trends */}
          <div className="h-full min-h-[300px]">
            <TrendChart
              title="Evolução de Atividades (Conexões)"
              data={filteredTrends}
              dataKeyBar="connected"
              dataKeyLine="activities"
              isDarkMode={isDark}
              className="h-full"
              unit="number"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const SalesView = () => (
    <div className="flex flex-col h-full gap-4 animate-in fade-in duration-500 overflow-y-auto pr-2">

      {/* 3.3.1 Comercial Macro (Closer Focus) */}
      <div className="flex flex-col gap-3 flex-shrink-0">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-l-4 border-emerald-500 pl-2">
          Comercial Macro (Fechamento)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeKPIs.meetingsHeld && <MetricCard metric={activeKPIs.meetingsHeld} context={data.context} />}
          {activeKPIs.sales && <MetricCard metric={activeKPIs.sales} context={data.context} />}
          {activeKPIs.conversionMeetingSale && <MetricCard metric={activeKPIs.conversionMeetingSale} context={data.context} />}
          {activeKPIs.noShowRate && <MetricCard metric={activeKPIs.noShowRate} context={data.context} inverse showPace={false} customComparison={{ value: 20, label: 'Teto Aceitável (%)' }} />}
        </div>
      </div>

      {/* 3.3.2 Comercial Micro (Pace Chart + Breakdown) */}
      <div className="flex flex-col gap-3 flex-1 min-h-0">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-l-4 border-teal-500 pl-2">
            Análise Micro: Ritmo & Faturamento
          </h3>
          <div className="text-xs text-slate-400">
            Ticket Médio Global: {activeKPIs.ticket ? formatValue(activeKPIs.ticket.value, 'currency') : 'R$ 0'}
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6 pb-4">
          {/* Goal Achievement Chart */}
          <div className="lg:col-span-2 h-full min-h-[300px]">
            <GoalAchievementChart
              title="Atingimento de Meta (Ritmo) - Faturamento"
              currentData={filteredTrends}
              dataKey="revenue"
              goal={activeKPIs.revenue?.goal || 0}
              totalDays={data.context.totalDays}
              currentDay={data.context.currentDay}
              isDarkMode={isDark}
              className="h-full"
              unit="currency"
            />
          </div>

          {/* Sales Breakdown */}
          <div className="lg:col-span-1 h-full min-h-[300px]">
            <DonutChart
              title="Faturamento por Tipo"
              data={[
                { name: 'Vendas Diretas', value: 135000 },
                { name: 'Parcerias', value: 50000 },
                { name: 'Recorrência', value: 30000 }
              ]}
              isDarkMode={isDark}
              className="h-full"
              unit="currency"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const RankingView = () => (
    <div className="flex flex-col h-full gap-6 animate-in fade-in duration-500 overflow-y-auto pr-2 pb-4">
      {/* SDR Rankings Section */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-l-4 border-indigo-500 pl-2 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Rankings SDR (Pré-Vendas)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-80"><RankingWidget<RepPerformance> title="Oportunidades Geradas" icon={<Zap className="w-4 h-4 text-brand-primary" />} data={filteredSDRs} accessor={(item) => item.opportunities || 0} labelAccessor={(item) => item.name} formatValue={(val) => val.toString()} /></div>
          <div className="h-80"><RankingWidget<RepPerformance> title="Conexões Realizadas" icon={<UserCheck className="w-4 h-4 text-emerald-500" />} data={filteredSDRs} accessor={(item) => item.connections || 0} labelAccessor={(item) => item.name} formatValue={(val) => val.toString()} /></div>
          <div className="h-80"><RankingWidget<RepPerformance> title="Reuniões Agendadas" icon={<Target className="w-4 h-4 text-indigo-500" />} data={filteredSDRs} accessor={(item) => item.meetingsBooked || 0} labelAccessor={(item) => item.name} formatValue={(val) => val.toString()} /></div>
          <div className="h-80"><RankingWidget<RepPerformance> title="Tempo de Resposta (min)" icon={<Clock className="w-4 h-4 text-rose-500" />} data={filteredSDRs} accessor={(item) => item.responseTime || 0} labelAccessor={(item) => item.name} formatValue={(val) => `${Number(val).toFixed(1)}m`} inverse={true} /></div>
          <div className="h-80"><RankingWidget<RepPerformance> title="Total de No-Show" icon={<AlertTriangle className="w-4 h-4 text-rose-500" />} data={filteredSDRs} accessor={(item) => item.noShowCount || 0} labelAccessor={(item) => item.name} formatValue={(val) => val.toString()} inverse={false} /></div>
          <div className="h-80"><RankingWidget<RepPerformance> title="Conversão (Conexão -> Agend.)" icon={<TrendingUp className="w-4 h-4 text-teal-500" />} data={filteredSDRs} accessor={(item) => item.connections ? (item.meetingsBooked! / item.connections) * 100 : 0} labelAccessor={(item) => item.name} formatValue={(val) => `${val.toFixed(1)}%`} /></div>
        </div>
      </div>

      {/* Sales Rankings Section */}
      <div className="flex flex-col gap-3 mt-4">
        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest border-l-4 border-emerald-500 pl-2 flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Rankings Closers (Vendas)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-80"><RankingWidget<RepPerformance> title="Total de Vendas" icon={<Trophy className="w-4 h-4 text-yellow-500" />} data={filteredClosers} accessor={(item) => item.sales || 0} labelAccessor={(item) => item.name} formatValue={(val) => val.toString()} /></div>
          <div className="h-80"><RankingWidget<RepPerformance> title="Faturamento Gerado" icon={<Banknote className="w-4 h-4 text-emerald-500" />} data={filteredClosers} accessor={(item) => item.revenue || 0} labelAccessor={(item) => item.name} formatValue={(val) => formatValue(val, 'currency')} /></div>
          <div className="h-80"><RankingWidget<RepPerformance> title="Taxa de Conversão" icon={<TrendingUp className="w-4 h-4 text-indigo-500" />} data={filteredClosers} accessor={(item) => item.meetingsHeld ? (item.sales! / item.meetingsHeld) * 100 : 0} labelAccessor={(item) => item.name} formatValue={(val) => `${val.toFixed(1)}%`} /></div>
          <div className="h-80"><RankingWidget<RepPerformance> title="Ticket Médio" icon={<BarChart2 className="w-4 h-4 text-brand-primary" />} data={filteredClosers} accessor={(item) => item.sales ? (item.revenue! / item.sales) : 0} labelAccessor={(item) => item.name} formatValue={(val) => formatValue(val, 'currency')} /></div>
          <div className="h-80"><RankingWidget<RepPerformance> title="Total de No-Show" icon={<AlertTriangle className="w-4 h-4 text-rose-500" />} data={filteredClosers} accessor={(item) => item.noShowCount || 0} labelAccessor={(item) => item.name} formatValue={(val) => val.toString()} inverse={false} /></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-slate-200 transition-colors duration-300 overflow-hidden">

      {/* Sidebar - Conditional rendering based on isSidebarHidden */}
      {!isSidebarHidden && (
        <aside
          className={`${isSidebarCollapsed ? 'w-20' : 'w-72'} 
            flex-shrink-0 bg-white dark:bg-[#0f172a]/90 backdrop-blur-md border-r border-slate-200 dark:border-slate-800 
            transition-all duration-300 flex flex-col z-50 h-full`}
        >
          {/* Header / Logo */}
          <div className="h-16 flex items-center justify-center border-b border-slate-200 dark:border-slate-800 relative">
            <div className={`flex items-center gap-3 overflow-hidden px-4 w-full ${isSidebarCollapsed ? 'justify-center' : ''}`}>
              {/* Logo Image */}
              <img
                src={
                  isSidebarCollapsed
                    ? (settings.theme === 'dark' ? ColapsedLogoDark : ColapsedLogoLight)
                    : (settings.theme === 'dark' ? LogoDark : LogoLight)
                }
                alt="Legacy Educação"
                className={`object-contain transition-all duration-300 ${isSidebarCollapsed ? 'w-10 h-10' : 'h-8 w-auto'}`}
              />
            </div>
          </div>

          {/* Menu Items - Main */}
          <div className="flex-1 py-6 space-y-2 overflow-y-auto px-3">
            {[
              { id: Tab.OVERVIEW, label: 'Visão Geral', icon: LayoutDashboard },
              { id: Tab.MARKETING, label: 'Marketing & MQL', icon: Megaphone },
              { id: Tab.SDR, label: 'SDR & Pré-Vendas', icon: Headset },
              { id: Tab.SALES, label: 'Vendas & Faturamento', icon: Banknote },
              { id: Tab.RANKING, label: 'Rankings', icon: Award }, // New Menu Item
              { id: Tab.BOARD, label: 'Board & Estratégia', icon: Presentation },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group
                  ${activeTab === tab.id
                    ? 'bg-brand-primary/10 text-brand-primary dark:text-brand-light shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                  }
                  ${isSidebarCollapsed ? 'justify-center' : ''}
                `}
                title={isSidebarCollapsed ? tab.label : ''}
              >
                <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-brand-primary dark:text-brand-light' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                {!isSidebarCollapsed && <span>{tab.label}</span>}
                {activeTab === tab.id && !isSidebarCollapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-primary shadow-[0_0_8px_rgba(23,173,253,0.6)]" />
                )}
              </button>
            ))}
          </div>

          {/* Footer / Settings Area */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">

            {/* Analysis Tab - Special Placement */}
            <div className="mb-2 pb-2 border-b border-slate-200 dark:border-slate-700/50">
              <button
                onClick={() => setActiveTab(Tab.ANALYSIS)}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group
                  ${activeTab === Tab.ANALYSIS
                    ? 'bg-brand-primary/10 text-brand-primary dark:text-brand-light shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
                  }
                  ${isSidebarCollapsed ? 'justify-center' : ''}
                `}
                title="Diagnóstico da Operação"
              >
                <Activity className={`w-5 h-5 ${activeTab === Tab.ANALYSIS ? 'text-brand-primary dark:text-brand-light' : 'text-slate-400'}`} />
                {!isSidebarCollapsed && <span>Diagnóstico</span>}
              </button>
            </div>


            {/* Collapse Toggle */}
            <button
              onClick={toggleSidebar}
              className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : (
                <div className="flex items-center gap-2 text-sm w-full">
                  <ChevronLeft className="w-4 h-4" />
                  <span>Recolher Menu</span>
                </div>
              )}
            </button>

            {/* TV Mode Toggle (Hide Sidebar) */}
            <button
              onClick={() => setIsSidebarHidden(true)}
              className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Modo TV / Tela Cheia"
            >
              {isSidebarCollapsed ? <Maximize2 className="w-5 h-5" /> : (
                <div className="flex items-center gap-2 text-sm w-full">
                  <Maximize2 className="w-4 h-4" />
                  <span>Modo TV / Full</span>
                </div>
              )}
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200
                text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200
                ${isSidebarCollapsed ? 'justify-center' : ''}
              `}
              title="Configurações"
            >
              <Settings className="w-5 h-5" />
              {!isSidebarCollapsed && <span>Configurações</span>}
            </button>
          </div>
        </aside>
      )}

      {/* Floating Button to Restore Sidebar */}
      {isSidebarHidden && (
        <button
          onClick={() => setIsSidebarHidden(false)}
          className="fixed bottom-6 left-6 z-50 p-3 bg-slate-800/90 text-white rounded-full shadow-lg hover:scale-110 transition-transform backdrop-blur-sm border border-slate-700"
          title="Sair do Modo TV"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col p-4 md:p-6 h-full overflow-hidden">
        {/* Header with Title and Auto-Rotate Status */}
        <header className="mb-2 flex-shrink-0 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white uppercase">
              {TAB_TITLES[activeTab]}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {activeTab === Tab.BOARD ? 'Área de trabalho livre para desenhar estratégias' : 'Performance e métricas em tempo real'}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {isSyncing && (
              <div className="flex items-center gap-2 text-brand-primary text-xs font-semibold animate-pulse bg-brand-primary/5 px-3 py-1.5 rounded-lg border border-brand-primary/20">
                <RefreshCcw className="w-3 h-3 animate-spin" />
                Sincronizando Meta Ads...
              </div>
            )}

            {isLoading && !isSyncing && (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Atualizando Dashboard...
              </div>
            )}

            {!isLoading && (
              <button
                onClick={() => loadData(true)}
                className="p-2 text-slate-500 hover:text-brand-primary transition-all rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90"
                title="Sincronizar e Atualizar"
              >
                <RefreshCcw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-brand-primary' : ''}`} />
              </button>
            )}

            {settings.autoRotate && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-brand-primary/10 rounded-full text-brand-primary text-xs font-medium border border-brand-primary/20 animate-pulse">
                <Play className="w-3 h-3" />
                <span>Auto: {settings.tabDurations[activeTab]}s</span>
              </div>
            )}
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
              Dia {data.context.currentDay} de {data.context.totalDays}
            </div>
          </div>
        </header>

        {/* Global Contextual Filters - Inserted Here */}
        {activeTab !== Tab.BOARD && (
          <FilterBar
            filters={filters}
            options={filterOptions}
            onFilterChange={handleFilterChange}
            visibleFilters={visibleFilters}
          />
        )}

        {/* View Content - Using flex-1 to take remaining height */}
        <div className="flex-1 min-h-0 relative">
          {isLoading ? (
            renderLoadingView()
          ) : (
            <>
              {activeTab === Tab.OVERVIEW && <OverviewView />}
              {activeTab === Tab.ANALYSIS && <AnalysisView />}
              {activeTab === Tab.MARKETING && <MarketingView />}
              {activeTab === Tab.SDR && <SdrView />}
              {activeTab === Tab.SALES && <SalesView />}
              {activeTab === Tab.RANKING && <RankingView />}
              {activeTab === Tab.BOARD && <Whiteboard isDarkMode={isDark} />}
            </>
          )}
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Configurações</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-slate-500 dark:hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
              {[
                { id: 'general', label: 'Preferências', icon: <Settings className="w-4 h-4" /> },
                { id: 'data', label: 'Importação', icon: <Activity className="w-4 h-4" /> },
                { id: 'goals', label: 'Metas', icon: <Target className="w-4 h-4" /> },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSettingsTab(t.id as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${settingsTab === t.id ? 'border-brand-primary text-brand-primary bg-brand-primary/5' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {settingsTab === 'general' && (
                <>
                  {/* Theme Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Aparência</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setSettings(s => ({ ...s, theme: 'light' }))}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${settings.theme === 'light' ? 'border-brand-primary bg-brand-primary/5 text-brand-primary' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                      >
                        <Sun className="w-5 h-5" />
                        <span>Modo Claro</span>
                      </button>
                      <button
                        onClick={() => setSettings(s => ({ ...s, theme: 'dark' }))}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${settings.theme === 'dark' ? 'border-brand-primary bg-brand-primary/5 text-brand-primary' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                      >
                        <Moon className="w-5 h-5" />
                        <span>Modo Escuro</span>
                      </button>
                    </div>
                  </div>

                  {/* Auto Rotation Config */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Rotação Automática</label>
                      <button
                        onClick={() => setSettings(s => ({ ...s, autoRotate: !s.autoRotate }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.autoRotate ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.autoRotate ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </div>

                    {settings.autoRotate && (
                      <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Defina o tempo (em segundos) por tela:</p>
                        {[
                          { id: Tab.OVERVIEW, label: 'Visão Geral' },
                          { id: Tab.ANALYSIS, label: 'Análise Geral' },
                          { id: Tab.MARKETING, label: 'Marketing' },
                          { id: Tab.SDR, label: 'SDR / Pré-Vendas' },
                          { id: Tab.SALES, label: 'Vendas' },
                          { id: Tab.RANKING, label: 'Rankings' },
                        ].map((tab) => (
                          <div key={tab.id} className="flex items-center justify-between">
                            <span className="text-sm text-slate-600 dark:text-slate-300">{tab.label}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="5"
                                value={settings.tabDurations[tab.id as keyof typeof settings.tabDurations]}
                                onChange={(e) => updateDuration(tab.id as Tab, parseInt(e.target.value) || 10)}
                                className="w-20 px-2 py-1 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-brand-primary"
                              />
                              <span className="text-xs text-slate-400">seg</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {settingsTab === 'data' && (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-brand-primary" />
                    Alimentação por Planilha (CSV)
                  </label>
                  {[
                    { id: 'marketing', label: 'Setor Marketing', icon: <Megaphone className="w-5 h-5" />, desc: 'Investimento, Leads e Conversão por Data' },
                    { id: 'commercial', label: 'Setor Comercial', icon: <Headset className="w-5 h-5" />, desc: 'Atividade de Vendedores e SDRs por Data' },
                  ].map((item) => (
                    <div key={item.id} className="relative">
                      <input
                        type="file"
                        accept=".csv"
                        id={`upload-${item.id}`}
                        className="hidden"
                        onChange={(e) => handleSectorUpload(e, item.id as any)}
                        disabled={isUploading}
                      />
                      <label
                        htmlFor={`upload-${item.id}`}
                        className={`group flex items-center justify-between w-full p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 cursor-pointer transition-all hover:border-brand-primary hover:bg-brand-primary/5 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-400 group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors">
                            {item.icon}
                          </div>
                          <div className="text-left">
                            <span className="block text-sm font-bold text-slate-800 dark:text-white uppercase tracking-tight">{item.label}</span>
                            <span className="block text-[10px] text-slate-500 font-medium">{item.desc}</span>
                          </div>
                        </div>
                        <RefreshCcw className="w-4 h-4 text-slate-300 group-hover:text-brand-primary transition-colors" />
                      </label>
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                    * O upload sobrescreve dados existentes com o mesmo ID/Data.
                  </p>
                </div>
              )}

              {settingsTab === 'goals' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Target className="w-4 h-4 text-brand-primary" />
                      Definição de Objetivos
                    </label>
                    <button
                      onClick={handleSaveGoals}
                      disabled={isUploading}
                      className="px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-lg hover:bg-brand-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                    >
                      {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                      SALVAR METAS
                    </button>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(data.kpis).map(([key, kpi]: [string, any]) => (
                      <div key={key} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{kpi.label}</span>
                          <span className="text-[10px] text-slate-400 uppercase font-bold">{kpi.unit}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] text-slate-400 block mb-1">Meta Mensal</label>
                            <input
                              type="number"
                              value={tempGoals[key] ?? kpi.goal}
                              onChange={(e) => setTempGoals(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-primary transition-colors"
                            />
                          </div>
                          <div className="w-24 text-right">
                            <label className="text-[10px] text-slate-400 block mb-1">Atual</label>
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 text-truncate block">
                              {kpi.prefix || ''}{kpi.value}{kpi.suffix || ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Message (Shared) */}
              {uploadStatus && (
                <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-900/20' : 'bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-900/10 dark:text-rose-400 dark:border-rose-900/20'}`}>
                  {uploadStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                  <span className="leading-tight">{uploadStatus.message}</span>
                </div>
              )}

              {isUploading && (
                <div className="flex items-center justify-center gap-2 text-slate-500 text-xs py-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Sincronizando dados...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
