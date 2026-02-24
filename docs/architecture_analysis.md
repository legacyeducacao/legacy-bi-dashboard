# Análise de Arquitetura de Dados - BI Intelligence

## 🔍 Diagnóstico Atual

A estrutura atual foi desenhada para rapidez e simplicidade (MVP), espelhando diretamente a necessidade do Frontend (React). Isso permite renderização rápida, mas limita severamente a capacidade analítica histórica e a escalabilidade.

### Pontos de Atenção (Gargalos) de Longo Prazo

1.  **Agregação Prematura (Perda de Granularidade)**:
    *   Tabelas como `marketing_channels` e `team_performance` armazenam apenas os **totais acumulados** (snapshot atual).
    *   **Problema**: Se você quiser saber "Quanto a Ana vendeu *mês passado*?" ou "Qual foi o ROI do Google Ads na *Black Friday*?", o banco atual não tem essa resposta, pois não há coluna de DATA nessas tabelas (apenas `updated_at`).

2.  **Falta de Tabela de Fatos (Transacional)**:
    *   O sistema atual opera como um *Data Mart* (Resultados Finais), mas não tem um *Data Warehouse* (Fatos Transacionais).
    *   Não existe uma tabela que registre "Venda X aconteceu no dia Y, pelo vendedor Z, do produto W".

3.  **Metas Estáticas**:
    *   A tabela `kpis` fixa a meta atual. Se a meta mudar em Março, perdemos o histórico de que a meta de Fevereiro era menor. O atingimento passado ficará incorreto.

---

## 🏗️ Proposta de Arquitetura Robusta (Modelo Star Schema)

Para transformar este projeto em um BI profissional escalável, recomendo a transição para um modelo multidimensional (Fatos e Dimensões).

### 1. Novas Tabelas "Fatos" (O que aconteceu e quando)

Estas tabelas devem ser alimentadas diariamente pelo n8n (append-only), permitindo qualquer recorte de tempo no futuro.

#### `fact_daily_marketing` (Granularidade: Dia + Canal + Campanha)
*   **Objetivo**: Saber exatamente onde o dinheiro foi gasto dia a dia.
*   **Colunas**:
    *   `date` (DATE) - PK Composta
    *   `channel_id` (FK) - PK Composta
    *   `campaign_id` (Texto - opcional, para drill down futuro)
    *   `cost` (Decimal)
    *   `impressions` (Int)
    *   `clicks` (Int)
    *   `leads` (Int)

#### `fact_deals` (Granularidade: Cada Negócio/Oportunidade)
*   **Objetivo**: Rastreabilidade total do funil de vendas. Esta é a tabela mais importante para atribuição.
*   **Colunas**:
    *   `deal_id` (Texto/UUID - vindo do HubSpot/CRM) - PK
    *   `created_at` (Timestamp)
    *   `closed_at` (Timestamp, nullable)
    *   `sdr_id` (FK - quem gerou)
    *   `closer_id` (FK - quem fechou)
    *   `value` (Decimal)
    *   `status` (Enum: 'Open', 'Won', 'Lost')
    *   `product_id` (FK - o que foi vendido)
    *   `lead_source` (FK - de onde veio)

#### `fact_sdr_activities` (Granularidade: Dia + SDR)
*   **Objetivo**: Monitorar produtividade diária.
*   **Colunas**:
    *   `date` (DATE)
    *   `sdr_id` (FK)
    *   `calls` (Int)
    *   `chats` (Int)
    *   `meetings_booked` (Int)

### 2. Tabelas Dimensão (Quem e O Que)

Normatizam os dados para evitar repetição de texto.

*   **`dim_team`**: `id`, `name`, `role`, `active`, `commission_rate`, `start_date`.
*   **`dim_products`**: `id`, `name`, `category`, `price`.
*   **`dim_channels`**: `id`, `name`, `platform` (Meta, Google, LinkedIn).
*   **`dim_goals`**: `month` (e.g. '2025-02'), `metric_id`, `target_value`. (Permite metas variáveis mês a mês).

---

## 🚀 Plano de Evolução (Sem Quebrar o Frontend Atual)

Não precisamos reescrever tudo agora. Podemos usar **Views** no Supabase para manter o Frontend funcionando enquanto melhoramos o Backend.

### Passo 1: Criar as Tabelas Fato (Backend Invisible)
Criar as tabelas sugeridas acima (`fact_...`) no Supabase e começar a populá-las via n8n.

### Passo 2: Criar Views de Compatibilidade
Substituir as tabelas atuais (`marketing_channels`, `team_performance`) por **Views SQL** que agregam as tabelas fato em tempo real.

**Exemplo Prático (SQL View para Canais):**
```sql
CREATE VIEW view_marketing_channels_legacy AS
SELECT 
    c.name as channel,
    SUM(f.cost) as investment,
    SUM(f.leads) as leads,
    -- ... calculos de ROAS/CPL dinâmicos
FROM fact_daily_marketing f
JOIN dim_channels c ON f.channel_id = c.id
WHERE f.date >= date_trunc('month', current_date) -- Filtra mês atual automaticamente
GROUP BY c.name;
```

### Benefícios Desta Abordagem
1.  **Histórico Preservado**: Você nunca mais perde dados passados.
2.  **Flexibilidade**: O Frontend pode pedir "Dados de Janeiro" ou "Dados de Fevereiro" apenas mudando o filtro da View, sem mudar código.
3.  **Auditoria**: Se um número estiver estranho, você pode olhar a `fact_deals` e achar exatamente qual venda causou a distorção.

## Recomendação Imediata

Se você quer apenas melhorar o atual sem mudar a arquitetura toda agora, a ação mais crítica é adicionar uma coluna `date` (ou `month`) nas tabelas `marketing_channels` e `team_performance` e fazer a Chave Primária ser composta (`id` + `date`). Isso já resolve o problema de perder o histórico mês a mês.
