# Como Filtrar por Data e Separar SDR de Closer no N8N

## Parte 1: Filtrando os Últimos 60 Dias
Para que a automação não puxe a base de dados inteira (e o limite de execução não estoure), nós devemos usar a **Operação de Busca (Search)** do N8N em vez da "Get Many".

1. No seu nó do HubSpot, mude o **Operation** de `Get Many` para `Search`.
2. Em **Return All**, deixe ligado.
3. Agora vai aparecer uma seção chamada **Filters**. Clique em `Add Filter` -> `Filter`.
4. Preencha as três caixinhas que aparecem na seguinte ordem:
   - **Property Name:** `createdate` (Essa é a Data de Criação do negócio).
   - **Operator:** `Greater than or equal to` (Maior ou igual a).
   - **Value:** Clique na engrenagem ao lado -> Add Expression. Delete o que estiver lá e cole isso: `{{ $today.minus(60, 'days').toSeconds() * 1000 }}`

Pronto! Ao executar o nó, ele trará apenas os negócios que foram criados nos últimos 60 dias exatos, filtrados milisegundo por milisegundo, economizando a sua cota da API.

---

## Parte 2: Puxando SDR e Closer Juntos

No HubSpot, o dono principal da venda (o Executivo/Closer) sempre fica na propriedade de fábrica **`hubspot_owner_id`**. Essa você já adicionou no pacote no passo anterior.

Porém, para sabermos quem foi o pré-vendas (SDR), a sua empresa certamente usa uma das duas opções:
- Ou existe um campo customizado no negócio, chamado "SDR Responsável" ou "Dono SDR".
- Ou a empresa de vocês atribui a pessoa através de "Atividades" e "Ligações". 

Vou chutar que é um campo de seleção customizado dentro do Negócio, por ser mais rastreável.
**Siga o mesmo passo da mensagem anterior (que procuramos a palavra Valor), mas agora procure pelo SDR.**

Vá nas Configurações ⚙️ -> Gerenciamento de Dados -> Propriedades -> Busque por **SDR**.
Ache a propriedade onde vocês selecionam o nome de quem agendou a reunião. Clique nela e descubra o **Nome Interno** (ex: `sdr_owner_id` ou `vendedor_pre_venda`).

Pegou essa palavra? Vá no seu N8N, na caixinha amarela do Expression, e enfie ela no pacote junto das outras:
```javascript
{{ [ 'dealname', 'dealstage', 'recent_deal_amount', 'amount', 'hubspot_owner_id', 'closedate', 'NOME_INTERNO_DO_SDR_AQUI' ] }}
```

Com ela puxada, o nosso Javascript consegue colocar as pontuações para ambos, Closer e SDR, sem sobrepor! Me diga se achou esse campo do SDR e eu te envio a última peça do robô.
