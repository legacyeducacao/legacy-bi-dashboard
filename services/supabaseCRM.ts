import type {
  CRMDealCreated,
  CRMDealUpdated,
  CRMActivityCreated,
  CRMActivityUpdated,
  CRMPersonCreated,
} from '../types';

const CRM_PROXY = '/api/supabase-crm';

async function fetchCRMTable<T>(table: string, params: Record<string, string> = {}): Promise<T[]> {
  const searchParams = new URLSearchParams({ table, ...params });
  const res = await fetch(`${CRM_PROXY}?${searchParams}`);
  if (!res.ok) {
    console.warn(`CRM proxy error (${table}):`, res.status);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// --- Deal Criado ---
export async function fetchDealsCreated(monthStart: string, monthEnd: string): Promise<CRMDealCreated[]> {
  return fetchCRMTable<CRMDealCreated>('Deal Criado', {
    select: '*',
    pipeline_id: 'eq.2',
    created_at: `gte.${monthStart}`,
    'created_at': `gte.${monthStart}`,
    order: 'created_at.desc',
    limit: '5000',
  });
}

// --- Deal Alterada ---
export async function fetchDealsUpdated(monthStart: string, monthEnd: string): Promise<CRMDealUpdated[]> {
  return fetchCRMTable<CRMDealUpdated>('Deal Alterada', {
    select: '*',
    pipeline_id: 'eq.2',
    order: 'created_at.desc',
    limit: '5000',
  });
}

// --- Won Deals ---
export async function fetchWonDeals(monthStart: string, monthEnd: string): Promise<CRMDealUpdated[]> {
  return fetchCRMTable<CRMDealUpdated>('Deal Alterada', {
    select: '*',
    Status: 'eq.won',
    pipeline_id: 'eq.2',
    order: 'created_at.desc',
    limit: '5000',
  });
}

// --- Lost Deals ---
export async function fetchLostDeals(monthStart: string, monthEnd: string): Promise<CRMDealUpdated[]> {
  return fetchCRMTable<CRMDealUpdated>('Deal Alterada', {
    select: '*',
    Status: 'eq.lost',
    pipeline_id: 'eq.2',
    order: 'created_at.desc',
    limit: '5000',
  });
}

// --- Atividades Criadas ---
export async function fetchActivitiesCreated(monthStart: string, monthEnd: string): Promise<CRMActivityCreated[]> {
  return fetchCRMTable<CRMActivityCreated>('atividade_criada', {
    select: '*',
    order: 'created_at.desc',
    limit: '5000',
  });
}

// --- Atividades Alteradas ---
export async function fetchActivitiesUpdated(monthStart: string, monthEnd: string): Promise<CRMActivityUpdated[]> {
  return fetchCRMTable<CRMActivityUpdated>('Atividade Alterada', {
    select: '*',
    order: 'created_at.desc',
    limit: '5000',
  });
}

// --- Person Criada ---
export async function fetchPersonsCreated(monthStart: string, monthEnd: string): Promise<CRMPersonCreated[]> {
  return fetchCRMTable<CRMPersonCreated>('Person Criada', {
    select: '*',
    order: 'created_at.desc',
    limit: '5000',
  });
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
