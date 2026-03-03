# Como Encontrar os "Nomes Internos" das suas Propriedades no HubSpot

Pelas fotos que você me mandou, o seu processo é **PERFEITO** para o nosso BI.
Eu vi ali campos vitais:
- **Etapa do negócio:** `Vendido` (O funil chama-se "Funil Comercial Legacy")
- **Valor:** `R$ 27.000`
- **Faturamento do Negócio:** `De 71 mil à 100 mil`

O único detalhe é que: naquelas 5 propriedades que você configurou no N8N (`amount`, `dealstage`, etc), o N8N tentou buscar os campos originais de fábrica do HubSpot.
Se o campo "Valor" for o padrão de fábrica, ele já vai vir na variável `amount`. 

Porém, as vezes nós criamos "Propriedades Customizadas" no HubSpot com nomes parecidos. Precisamos ter **100% de certeza absoluta** de qual é o "Nome Interno" da propriedade que você quer que o BI leia para calcular o faturamento mensal e de qual é a propriedade para "Etapa do Negócio".

### Passo a Passo: Descobrindo o Nome Secreto (1 minuto)

1. No seu **HubSpot**, vá lá em cima na engrenagem de configurações ⚙️ (Canto superior direito).
2. No menu esquerdo, desça até **Gerenciamento de Dados** -> **Propriedades**.
3. Na busca de propriedades, digite a palavra **Valor**.
4. Quando aparecer a propriedade do Dinheiro (a que você usa para R$ 27.000), clique no nome dela.
5. Vai abrir uma janela lateral. Nela, vai ter um botão parecido com `</>` ou um texto escrito **"Nome interno"**. 
6. Copie esse "Nome interno". (Geralmente é `amount` se for o de fábrica, mas pode ser algo como `valor_da_venda`).
7. Faça o **mesmo processo** na busca para a propriedade **Etapa do Negócio**. 
   *(Geralmente é `dealstage`, mas se vocês criaram um funil customizado pode se chamar `fase_do_pipeline` ou algo assim).*

Me diga quais foram os **dois Nomes Internos** que você achou para "Valor" e "Etapa do negócio". Com essas duas palavras, nosso script não tem como falhar!
