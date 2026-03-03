# Guia: Como configurar o Status no N8N (Versão HTTP / Raw)

Pela sua imagem, vejo que você está usando um nó de requisição direta à API do Facebook (talvez um nó HTTP Request ou um nó Genérico configurado na mão) chamando o endpoint `insights`.

Como você precisa juntar as coisas, você tem duas opções:

## Opção 1: Adicionar um Segundo Nó para Campanhas (Recomendado)
Você precisa de **OUTRO NÓ** idêntico a esse da sua foto, mas apontando para o endpoint de campanhas e não de insights.
1. Copie e cole esse nó da sua foto.
2. No novo nó colado (Cópia), mude o **Edge** (provavelmente está como `insights` na URL do nó, mude para `campaigns`).
3. Nas propriedades Query Parameters da cópia, **APAGUE TUDO** e coloque apenas:
   - Name: `fields`
   - Value: `name,effective_status`
   - Name: `limit`
   - Value: `3000`
4. Puxe um fio (connection) da saída desse novo nó e ligue no nosso nó de código `Transform Meta Data` (deixando os dois ligados ao mesmo tempo).

## Opção 2: Adicionar um Nó N8N Nativo de "Get Many Campaigns"
Em vez de clonar o nó Raw, clique no `+` e adicione o nó nativo:
- Procure por: **Facebook Marketing**
- Resource: `Campaign`
- Operation: `Get Many`
- E ligue a saída dele junto com o seu nó na entrada do Código JavaScript.
