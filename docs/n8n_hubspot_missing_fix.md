# Como Adicionar as Propriedades Faltantes no N8N

Obrigado pelo JSON! O mistério está resolvido: O HubSpot da sua conta devolveu apenas o Nome de cada negócio (ex: "Roberto", "Lara", "Teka Esther Viana"), mas ele **não enviou** o Faturamento, nem a Fase, nem o Dono no pacote.

Isso significa que lá nas opções daquele nó do N8N onde diz **"Deal Properties to Include"**, nós precisamos forçar a inclusão. Sem eles estarem listados na caixinha, o HubSpot envia o pacote "mínimo", que é só o nome.

### Siga Exatamente Estes Passos:

1. Volte na edição do **Nó "Get Many" Deals do Hubspot**.
2. Desça a página até o campo **"Deal Properties to Include"**.
3. **Pare o mouse em cima dele**, apague e escreva **na mão** (copie e cole) uma palavra de cada vez, dando ENTER ou vírgula para ele entender cada uma (caso o autocompletar não sugira, apenas cole e force ele aceitar):
   - `amount`
   - `dealstage`
   - `hubspot_owner_id`
   - `closedate`

> **Note:** O N8N pode relutantemente não sugerir essas palavras da lista, mas se você simplesmente digitar `amount` e pressionar ENTER, ele salva a string do mesmo jeito!

### Validação

Depois que você encher aquela caixinha **Deal Properties to Include** com essas 4 palavras acima, clique no **Execute** do nó de novo.

Se você clicar na aba JSON de novo, você deve começar a ver a mágica acontecendo num daqueles 250 negócios:
```json
"dealname": { "value": "Teka Esther Viana" },
"amount": { "value": "5000" },
"dealstage": { "value": "closedwon" },
"hubspot_owner_id": { "value": "62264824" }
```

Assim que essas palavras aparecerem no JSON, **o seu banco de dados inteiro que está aguardando já vai encher de números e vendas!** Consegue colocar essas palavras e testar uma execução?
