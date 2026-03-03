# Como Encontrar as Propriedades Ocultas do HubSpot no N8N

O script processou perfeitamente a lógica, mas retornou `Sem_Dono` e `0` para tudo. Isso aconteceu porque **os nomes internos do seu HubSpot são diferentes** do padrão esperado pelo código (como `dealname`, `amount`, `dealstage` e `hubspot_owner_id`).

Para arrumar isso em 1 minuto, precisamos olhar o JSON real (o "esqueleto" escondido) que o nó do HubSpot entregou.

## O Que Fazer:

1. Volte naquele nó do HubSpot (O **Get Many** Deals).
2. Clique na aba **JSON** no painel da direita (onde ficam os resultados ou Output Data).
3. Você verá uma estrutura parecida com esta:
```json
{
  "properties": {
    "NOME_ESTRANHO_DEALNAME": { "value": "Lara" },
    "NOME_ESTRANHO_VALOR": { "value": "1500" },
    "NOME_ESTRANHO_FASE": { "value": "vendido" },
    "NOME_ESTRANHO_DONO": { "value": "12345" }
  }
}
```
4. Copie esse pequeno trecho da aba JSON (de apenas 1 negócio) e cole aqui no chat.

Assim que eu ver quais foram as palavras que o HubSpot usou (ex: talvez ele tenha usado `hs_deal_stage` em vez de `dealstage`, `hs_amount` ou algo customizado da sua empresa), eu ajusto o script na hora e ele vai puxar todos os valores mágicamente!
