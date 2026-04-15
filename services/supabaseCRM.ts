import { supabase, isSupabaseConfigured } from './supabase';
import type {
  CRMDealCreated,
  CRMDealUpdated,
  CRMActivityCreated,
  CRMActivityUpdated,
  CRMPersonCreated,
} from '../types';

// --- Deal Criado ---
export async function fetchDealsCreated(monthStart: string, monthEnd: string): Promise<CRMDealCreated[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('Deal Criado')
    .select('*')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd + 'T23:59:59')
    .eq('pipeline_id', '2')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) { console.warn('CRM Deal Criado error:', error.message); return []; }
  return data || [];
}

// --- Deal Alterada (latest state per deal) ---
export async function fetchDealsUpdated(monthStart: string, monthEnd: string): Promise<CRMDealUpdated[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('Deal Alterada')
    .select('*')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd + 'T23:59:59')
    .eq('pipeline_id', '2')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) { console.warn('CRM Deal Alterada error:', error.message); return []; }
  return data || [];
}

// --- Won Deals ---
export async function fetchWonDeals(monthStart: string, monthEnd: string): Promise<CRMDealUpdated[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('Deal Alterada')
    .select('*')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd + 'T23:59:59')
    .eq('Status', 'won')
    .eq('pipeline_id', '2')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) { console.warn('CRM Won Deals error:', error.message); return []; }
  return data || [];
}

// --- Lost Deals ---
export async function fetchLostDeals(monthStart: string, monthEnd: string): Promise<CRMDealUpdated[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('Deal Alterada')
    .select('*')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd + 'T23:59:59')
    .eq('Status', 'lost')
    .eq('pipeline_id', '2')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) { console.warn('CRM Lost Deals error:', error.message); return []; }
  return data || [];
}

// --- Atividades Criadas ---
export async function fetchActivitiesCreated(monthStart: string, monthEnd: string): Promise<CRMActivityCreated[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('atividade_criada')
    .select('*')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd + 'T23:59:59')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) { console.warn('CRM atividade_criada error:', error.message); return []; }
  return data || [];
}

// --- Atividades Alteradas ---
export async function fetchActivitiesUpdated(monthStart: string, monthEnd: string): Promise<CRMActivityUpdated[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('Atividade Alterada')
    .select('*')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd + 'T23:59:59')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) { console.warn('CRM Atividade Alterada error:', error.message); return []; }
  return data || [];
}

// --- Person Criada ---
export async function fetchPersonsCreated(monthStart: string, monthEnd: string): Promise<CRMPersonCreated[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('Person Criada')
    .select('*')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd + 'T23:59:59')
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) { console.warn('CRM Person Criada error:', error.message); return []; }
  return data || [];
}

// --- Fetch all CRM data in parallel ---
export async function fetchAllCRMData(monthStart: string, monthEnd: string) {
  const [
    dealsCreated,
    dealsUpdated,
    wonDeals,
    lostDeals,
    activitiesCreated,
    activitiesUpdated,
    personsCreated,
  ] = await Promise.all([
    fetchDealsCreated(monthStart, monthEnd),
    fetchDealsUpdated(monthStart, monthEnd),
    fetchWonDeals(monthStart, monthEnd),
    fetchLostDeals(monthStart, monthEnd),
    fetchActivitiesCreated(monthStart, monthEnd),
    fetchActivitiesUpdated(monthStart, monthEnd),
    fetchPersonsCreated(monthStart, monthEnd),
  ]);

  return {
    dealsCreated,
    dealsUpdated,
    wonDeals,
    lostDeals,
    activitiesCreated,
    activitiesUpdated,
    personsCreated,
  };
}

// --- Helpers ---

// Deduplicate Deal Alterada: keep latest row per deal id
export function getLatestDealStates(deals: CRMDealUpdated[]): CRMDealUpdated[] {
  const map = new Map<string, CRMDealUpdated>();
  // deals already sorted desc by created_at, so first occurrence is latest
  for (const d of deals) {
    if (d.id && !map.has(d.id)) {
      map.set(d.id, d);
    }
  }
  return Array.from(map.values());
}

// Deduplicate won deals: keep latest per deal id (with highest valor)
export function getUniqueWonDeals(deals: CRMDealUpdated[]): CRMDealUpdated[] {
  const map = new Map<string, CRMDealUpdated>();
  for (const d of deals) {
    if (!d.id) continue;
    const existing = map.get(d.id);
    if (!existing || (d.valor || 0) > (existing.valor || 0)) {
      map.set(d.id, d);
    }
  }
  return Array.from(map.values());
}
