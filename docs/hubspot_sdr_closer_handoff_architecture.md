# Reengenharia: Lidando com a Troca de Bastão SDR -> Closer

Quando não temos uma propriedade estática de SDR, e o Negócio muda de dono no meio do funil, não podemos simplesmente usar a linha final do JSON (que sempre mostrará o Closer atual) para dar a pontuação de agendamentos passados, senão o Closer roubará o mérito de "Meetings Booked" do SDR.

## A Solução: Lendo o passado (`versions`)
Reparei nos JSONs enviados anteriormente que o N8N já traz o arranjo precioso: a lista de **`versions`**.

```json
"hubspot_owner_id": {
  "value": "2011790555",           // O Atual
  "versions": [                    // O Passado
    { "value": "2011790555", "timestamp": 1764966357340 },
    { "value": "999888777", "timestamp": 1764000000000 } // Esse cara foi o SDR!
  ]
}
```

O desafio é: O HubSpot, por padrão, só entrega o histórico (versions) de **algumas** propriedades da tela. Para pegar todo o histórico de um Negócio, o N8N precisa ativar o `Deal Properties with History to Include`. 

### A Nova Lógica do JavaScript
1. Pega todas as etapas que o negócio passou (histórico do Stage).
2. Para cada etapa (agendou, vendeu), olha a data exata.
3. Busca no histórico de Donos (`hubspot_owner_id.versions`) quem era o dono do negócio **naquela exata hora/dia**.
4. Pontua a ação (SDR/Reunião para quem era o dono lá trás, Closer/Venda para quem era o dono lá na frente).

Isso garante 100% de justiça sem precisar de campos customizados novos no CRM. O Javascript ficará ligeiramente mais complexo, mas abstrairá todo o problema para o usuário.
