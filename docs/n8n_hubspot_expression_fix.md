# Solução com a Aba Expression (N8N)

Excelente ideia usar a aba `Expression`! Ela burla a trava visual do N8N e injeta o array diretamente na requisição.

Visto que o campo `Deal Properties to Include` espera receber uma lista (Array) de palavras, você deve preencher o campo de expressão (dentro do `{{ }}`) do seguinte modo:

```javascript
{{ [ 'amount', 'dealstage', 'hubspot_owner_id', 'closedate' ] }}
```

**ATENÇÃO AS VÍRGULAS E ASPAS:**
- As palavras precisam estar entre aspas simples (`'`).
- Precisam estar separadas por vírgula.
- Tudo isso dentro dos colchetes `[ ]`.

Pronto! Ao colocar isso, o texto em verde piscante embaixo (Result) deve mostrar `[Array: ["amount", "dealstage", "hubspot_owner_id", "closedate"]]`. 

Assim que mostrar isso, basta dar o **Execute** no nó do Hubspot e ir pra aba JSON ver as mágicas aparecerem!
