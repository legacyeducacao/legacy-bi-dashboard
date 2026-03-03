import json
from datetime import datetime, timezone

file_path = r'c:\Users\Hills\Documents\Projeto BI\docs\hubretun-test.json'

with open(file_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

results = data[0].get('results', [])

print(f"Total records in results: {len(results)}")

created_dates = []
properties_createdate = []
properties_hs_createdate = []

def parse_iso(dt_str):
    if dt_str.endswith('Z'):
        dt_str = dt_str[:-1] + '+00:00'
    return datetime.fromisoformat(dt_str)

for record in results:
    if 'createdAt' in record:
        try:
            created_dates.append(parse_iso(record['createdAt']))
        except Exception as e:
            pass
    
    if 'properties' in record:
        props = record['properties']
        if 'createdate' in props and props['createdate']:
            try:
                properties_createdate.append(parse_iso(props['createdate']))
            except Exception as e:
                pass
        if 'hs_createdate' in props and props['hs_createdate']:
            try:
                properties_hs_createdate.append(parse_iso(props['hs_createdate']))
            except Exception as e:
                pass

def print_stats(name, dates):
    if not dates:
        print(f"No {name} found.")
        return
    now = parse_iso('2026-03-02T00:00:00Z')
    mx = max(dates)
    mn = min(dates)
    print(f"--- {name} Stats ---")
    print(f"Count: {len(dates)}")
    print(f"Oldest: {mn} ({(now - mn).days} days ago from 2026-03-02)")
    print(f"Newest: {mx} ({(now - mx).days} days ago from 2026-03-02)")

print_stats('createdAt', created_dates)
print_stats('properties.createdate', properties_createdate)
print_stats('properties.hs_createdate', properties_hs_createdate)
