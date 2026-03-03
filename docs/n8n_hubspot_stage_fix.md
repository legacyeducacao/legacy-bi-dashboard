# Como arrumar as Vendas Zeradas no N8N

Para eu te dar o código já corrigido na hora, precisamos descobrir **QUAL É A PALAVRA OU CÓDIGO EXATO** que o HubSpot chama a sua etapa de Vendas.

Faça exatamente isso agora no seu N8N:

1. **Abra o seu nó do HubSpot** (o Get Many).
2. Clique no botão de **Execute Node / Test**.
3. Quando terminar, clique na aba escrita **JSON** no lado direito (onde saem os resultados).
4. Procure alguma linha que tenha a propriedade "dealstage". Ela vai estar mais ou menos assim:
   `"dealstage": { "value": "ID_ESTRANHO_OU_NOME_AQUI" }`
5. **Copie o que está escrito dentro de "value" e me mande aqui.**

Se você não quiser procurar, simplesmente **copie os primeiros 20 linhas daquela tela de JSON** e cole no chat que eu encontro pra você.

Assim que me mandar, eu digo: "Troque a linha X por Y" e todos os seus 250 negócios vão virar vendas no banco de dados.
