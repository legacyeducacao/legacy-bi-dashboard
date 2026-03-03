# Resolução: Por que retornou só ID?

Quando configuramos o Resource `Campaign` e Operation `Get Many`, a API do Meta nativa no N8N costuma ignorar quais campos passamos se não usarmos o nó correto atrelado à **Conta de Anúncio (Ad Account)**. O endpoint `/campaigns` atrelado no root do node às vezes só traz o esqueleto.

## A Solução (Caminho Correto)

No seu segundo nó (o novo, que criamos para listar campanhas), use exatamente esta estrutura:

1. **Resource:** `Ad Account`
2. **Operation:** `Get Campaigns`
3. **Fields:** Aqui você digita: `name,effective_status` (com a vírgula, tudo junto).
4. **Limit:** 500 (ou deixa Return All).

Quando fazemos `Ad Account -> Get Campaigns` passando o field `name,effective_status`, o n8n constrói a URL correta por baixo dos panos: 
`act_XXXXXXXX/campaigns?fields=name,effective_status`

Isso força a API do Meta a retornar o nome e o status de cada campanha dentro da sua conta.
