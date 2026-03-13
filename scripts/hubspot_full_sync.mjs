import fetch from 'node-fetch';
import fs from 'fs';
import https from 'https';

const HUBSPOT_TOKEN = 'pat-na1-134a4b35-253e-4b87-b9fa-8e6565ad2582';
const SUPABASE_URL = 'https://ibhkisoudreapebtvpga.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliaGtpc291ZHJlYXBlYnR2cGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0Mzg5ODIsImV4cCI6MjA4NzAxNDk4Mn0.jSaYkf0stVkPxw3bWAIxsDl0sFVPsOynShNQDua4AxY';

const STAGE_MAP = {
    '1225098146': 'opportunities',
    '1225098147': 'connections',
    '1225098148': 'connections',
    '1225098149': 'connections',
    '1225098150': 'connections',
    '1225098151': 'connections',
    '1225024929': 'connections',
    '1225098152': 'sales',         
    '1226813477': 'connections',   
};

const WON_STAGES = new Set(['1225098152']);

const OWNER_MAP = {
    '86857769':   { name: 'Isaque Inacio',    role: 'SDR'    },
    '85822345':   { name: 'Luan Silva',        role: 'SDR'    },
    '1856577327': { name: 'Rodrigo Fernandes', role: 'SDR'    },
    '69864695':   { name: 'Rodrigo Fernandes', role: 'SDR'    },
    '2011790555': { name: 'Rodrigo Fernandes', role: 'SDR'    },
    '78938498':   { name: 'Leonardo Padilha',  role: 'Closer' },
    '86362284':   { name: 'Leonardo Souza',    role: 'Closer' },
    '85369712':   { name: 'Joel Carlos',       role: 'Closer' }
};

// Start from beginning of previous month
const START_DATE = new Date();
START_DATE.setMonth(START_DATE.getMonth() - 1);
START_DATE.setDate(1);
START_DATE.setHours(0,0,0,0);
const strToday = new Date().toISOString().split('T')[0];

function safeDate(timestamp) {
    if (!timestamp) return new Date().toISOString();
    if (!isNaN(timestamp)) return new Date(Number(timestamp)).toISOString();
    try {
        const d = new Date(timestamp);
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    } catch(e) {
        return new Date().toISOString();
    }
}

const results = {};

function getInitObj(date, name, role) {
    const key = `${date}|${name}`;
    if (!results[key]) {
        results[key] = {
            date, rep_name: name, role,
            opportunities: 0, connections: 0,
            meetings_booked: 0, meetings_held: 0, no_shows: 0,
            sales: 0, revenue: 0.00,
            response_time_sum: 0, response_time_count: 0,
            inbound: 0, outbound: 0
        };
    }
    return results[key];
}

function resolveAllOwners(ownerHistory, currentOwnerId) {
    const owners = [];
    const sorted = [...(ownerHistory || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    for (const entry of sorted) {
        if (OWNER_MAP[entry.value]) owners.push(OWNER_MAP[entry.value]);
    }
    if (OWNER_MAP[currentOwnerId]) owners.push(OWNER_MAP[currentOwnerId]);
    return owners;
}

function resolveOwnerByStageHistory(stageHistory) {
    const sorted = [...(stageHistory || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    for (const entry of sorted) {
        if (!WON_STAGES.has(entry.value)) continue;
        const userId = String(entry.updatedByUserId || '');
        if (OWNER_MAP[userId]) return OWNER_MAP[userId];
    }
    return null;
}

async function fetchHubSpot(endpoint, body) {
    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/${endpoint}/search`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    const data = await res.json();
    return data.results || [];
}

async function main() {
    console.log(`Starting full sync from ${START_DATE.toISOString()}`);
    let allDeals = [];
    let hasMore = true;
    let after = undefined;

    while (hasMore) {
        const body = {
            filterGroups: [{
                filters: [{
                    propertyName: 'hs_lastmodifieddate',
                    operator: 'GTE',
                    value: START_DATE.getTime()
                }]
            }],
            properties: ["amount", "dealname", "hubspot_owner_id", "dealstage", "response_time_1_ligacao", "hs_analytics_source", "closedate", "createdate"],
            limit: 50,
            sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }]
        };
        if (after) body.after = after;

        const res = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/search`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        
        let batchIds = data.results.map(d => ({id: d.id}));
        if(batchIds.length > 0) {
            // Need to fetch history
             const resHist = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/batch/read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  "properties": ["amount", "dealname", "hubspot_owner_id", "dealstage", "response_time_1_ligacao", "hs_analytics_source", "closedate", "createdate"],
                  "propertiesWithHistory": ["dealstage", "hubspot_owner_id"],
                  "inputs": batchIds
                })
             });
             if (!resHist.ok) {
                 const errText = await resHist.text();
                 fs.writeFileSync('c:/tmp/hubspot_err.txt', errText);
                 console.log("Wrote error to c:/tmp/hubspot_err.txt");
                 break;
             } else {
                 const dataHist = await resHist.json();
                 allDeals.push(...(dataHist.results || []));
             }
        }

        if (data.paging && data.paging.next) {
            after = data.paging.next.after;
            console.log("Fetching next page...");
        } else {
            hasMore = false;
        }
    }

    console.log(`Fetched ${allDeals.length} deals.`);

    for (const item of allDeals) {
        if (item.id === '56875232797') {
           console.log("=== AMBROZIOCAR ===");
           console.log(JSON.stringify(item, null, 2));
        }
        
        const props = item.properties || item;
        if (props.dealstage === undefined) continue;

        const currentOwnerId = String(props.hubspot_owner_id || '');
        const ownerHistory   = item.propertiesWithHistory?.hubspot_owner_id || [];

        let allOwners = resolveAllOwners(ownerHistory, currentOwnerId);
        let sdrOwner = allOwners.find(o => o.role === 'SDR') || allOwners[0];
        let closerOwner = [...allOwners].reverse().find(o => o.role === 'Closer') || allOwners[allOwners.length - 1];

        if (!closerOwner && WON_STAGES.has(props.dealstage)) {
            const stageHistory = item.propertiesWithHistory?.dealstage || [];
            const fbOwner = resolveOwnerByStageHistory(stageHistory);
            if (fbOwner) closerOwner = fbOwner;
        }
        if (!sdrOwner && closerOwner) sdrOwner = closerOwner;
        if (!sdrOwner && !closerOwner) {
            if (item.id === '56875232797') console.log("Missing owner - SKIP");
            continue;
        }

        const amountVal  = parseFloat(props.amount) || 0;
        const respTimeMs = parseFloat(props.response_time_1_ligacao) || 0;
        const src = String(props.hs_analytics_source || props.origem_do_lead || '').toUpperCase();
        const isInbound = ['PAID_SOCIAL','PAID_SEARCH','ORGANIC_SEARCH','ORGANIC_SOCIAL','EMAIL_MARKETING','REFERRALS','INBOUND'].some(k => src.includes(k));

        const stageHistory = item.propertiesWithHistory?.dealstage || [];
        const stagesToProcess = stageHistory.length > 0 ? stageHistory : [{ value: props.dealstage, timestamp: props.closedate || props.createdate || new Date().toISOString() }];

        if (item.id === '56875232797') console.log("Processing stages:", stagesToProcess.length);

        const processed = new Set();
        for (const stg of stagesToProcess) {
            const mapped = STAGE_MAP[stg.value];
            if (!mapped) continue;
            if (processed.has(mapped) && mapped !== 'opportunities') continue;
            processed.add(mapped);

            let tsToUse = stg.timestamp;
            if (mapped === 'sales' && props.closedate) tsToUse = props.closedate;
            
            let dateStr = safeDate(tsToUse || props.createdate).split('T')[0];
            if (new Date(dateStr) < START_DATE) continue; // Skip events before last month

            if (mapped === 'sales') {
                if (!WON_STAGES.has(props.dealstage)) continue;
                if (!closerOwner) continue;
                console.log(`SALE: [${dateStr}] Deal: ${props.dealname} (${item.id}) by ${closerOwner.name} | CloseDate: ${props.closedate}`);
                const obj = getInitObj(dateStr, closerOwner.name, closerOwner.role);
                obj.sales   += 1;
                obj.revenue += amountVal;
            } else if (mapped === 'opportunities') {
                if (!sdrOwner) continue;
                const obj = getInitObj(dateStr, sdrOwner.name, sdrOwner.role);
                obj.opportunities += 1;
                if (respTimeMs > 0) {
                    obj.response_time_sum   += respTimeMs > 10000 ? respTimeMs / 60000 : respTimeMs;
                    obj.response_time_count += 1;
                }
                if (isInbound) obj.inbound += 1;
                else           obj.outbound += 1;
            } else if (mapped === 'connections') {
                if (!sdrOwner) continue;
                const obj = getInitObj(dateStr, sdrOwner.name, sdrOwner.role);
                obj.connections += 1;
            } else if (mapped === 'no_shows') {
                if (!closerOwner) continue;
                const obj = getInitObj(dateStr, closerOwner.name, closerOwner.role);
                obj.no_shows += 1;
            }
        }
    }

    // Now process meetings
    let allMeetings = [];
    hasMore = true;
    after = undefined;
    while(hasMore) {
        const res = await fetch(`https://api.hubapi.com/crm/v3/objects/meetings/search`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filterGroups: [{
                    filters: [{
                        propertyName: 'hs_lastmodifieddate',
                        operator: 'GTE',
                        value: START_DATE.getTime()
                    }]
                }],
                limit: 100,
                after
            })
        });
        const data = await res.json();
        allMeetings.push(...(data.results || []));
        if (data.paging && data.paging.next) {
            after = data.paging.next.after;
        } else {
            hasMore = false;
        }
    }

    console.log(`Fetched ${allMeetings.length} meetings.`);

    for (const item of allMeetings) {
        const props = item.properties || item;
        const closerId   = String(props.hubspot_owner_id || '');
        const bookedById = String(props.hs_created_by || props.hubspot_owner_id || '');
        const closerInfo = OWNER_MAP[closerId];
        const bookerInfo = OWNER_MAP[bookedById];

        const ownerForResult = closerInfo || bookerInfo;
        if (!ownerForResult) continue;

        const startTs   = props.hs_meeting_start_time || props.hs_createdate || new Date().toISOString();
        const startDate = startTs.split('T')[0];
        if (new Date(startDate) < START_DATE) continue;

        const outcome   = String(props.hs_meeting_outcome || '').toUpperCase();
        const rec = getInitObj(startDate, ownerForResult.name, ownerForResult.role);

        if (['COMPLETED', 'BUSY', 'REALIZADA'].includes(outcome)) {
            rec.meetings_held += 1;
        } else if (['NO_SHOW', 'CANCELLED', 'NO_SHOW_SCHEDULED', 'CANCELED'].includes(outcome)) {
            rec.no_shows += 1;
        } else if (new Date(startTs) < new Date() && outcome === '') {
            rec.meetings_held += 1;
        }
        // Meetings Booked was already tracked by opportunities stage switch
    }

    console.log("Saving to Supabase...");
    
    // Convert to array
    const finalData = Object.values(results);
    
    // First, zero out all data since START_DATE logically (we do it day by day or just overwrite using the UPSERT correctly? Wait, UPSERT only overwrites days that currently have data in our array! To truly FIX it, we need to ZERO out everything since start date, THEN upsert).
    const deleteQuery = `
        DELETE FROM fact_team_activities 
        WHERE date >= '${START_DATE.toISOString().split('T')[0]}';
    `;
    
    const dbPost = async (query) => {
        return fetch(SUPABASE_URL + '/graphql', { // Wait, graphql maybe not. Better use REST SQL proxy or write a script to execute SQL via Postgres node module... Wait, I can just use the N8N REST endpoint or Supabase REST endpoints.
        });
    }
    
    fs.writeFileSync('c:/tmp/final_sync_data.json', JSON.stringify(finalData, null, 2));
    console.log("Wrote raw combined data to c:/tmp/final_sync_data.json");
    
}

main().catch(console.error);
