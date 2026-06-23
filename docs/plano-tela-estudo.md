# Plano — Ajuste da tela "Estudo de Tempo" (resumo da semana)

> Preparado em 23/06/2026 para execução no dia seguinte. Mudança **somente na tela**
> (não na impressão, nos cálculos ou nos parâmetros de negócio).

## Objetivo
Aproveitar melhor o espaço da tela (telas largas com muito espaço vazio), trazendo
as informações principais para cima (menos rolagem) e separando a lista de produtos.

## Decisões já tomadas
1. **Produtos a Embalar → aba própria.** Criar uma 2ª aba no topo, ao lado de
   "Estudo de Tempo". O resumo da semana fica enxuto (KPIs + tabela da semana +
   dia crítico + gráfico); o detalhamento por dia vai para a aba separada.
2. **Faixa de KPIs no topo.** Compactar "Indicadores da Semana" + "Resumo
   Executivo" numa faixa horizontal logo abaixo do título, usando a largura, para
   os números aparecerem sem rolar.

## Estado atual do código (âncoras)
- `index.html` e `app.html` são **idênticos** (ambos servidos pela Vercel). Toda
  alteração deve ser aplicada nos dois (ou editar um e `cp index.html app.html`).
- Navegação de abas: `<nav class="app-tabs">` (~linha 650) hoje só tem o botão
  "Estudo de Tempo" → `switchTab('programacao')`. A função `switchTab` (no script)
  já alterna `.tab-panel`/`.app-tab` e foi corrigida para casar a aba ativa pelo
  nome (não mais por índice posicional).
- Painéis existentes: `#tab-programacao` (ativo), além de `#tab-operador`,
  `#tab-tv`, `#tab-simulacoes` (mantidos no código, sem navegação — desativados).
- Resumo da semana é montado em `progCarregarSemana()` (~linha 2481). A string
  final é injetada em `#prog-semana-body`:
  `indicadoresHtml + html + printHtml + execHtml + critHtml + det + grafHtml`.
- `det` (~linha 2673) é o bloco "Produtos a embalar" (tabelas por dia). Hoje é
  concatenado dentro de `#prog-semana-body`.

## Plano de implementação
1. **Criar a aba "Produtos a Embalar"**
   - Adicionar o botão no `<nav class="app-tabs">`:
     `<button class="app-tab" onclick="switchTab('produtos')">Produtos a Embalar</button>`.
   - Criar o painel `<div id="tab-produtos" class="tab-panel">` com um contêiner
     `#produtos-body` para receber o HTML dos produtos.
   - Conferir `switchTab`: o realce já casa pelo nome via `onclick`; garantir que
     `document.getElementById('tab-'+name)` exista para `produtos`.

2. **Mover o `det` para a nova aba**
   - Em `progCarregarSemana`, parar de concatenar `det` em `#prog-semana-body` e
     passar a injetá-lo em `#produtos-body` (ou guardar e renderizar ao abrir a aba).
   - Manter a geração do `det` exatamente como está (mesmos cálculos/colunas).
   - Atenção à **impressão**: hoje o print do resumo usa `body.print-semana` e o
     "só resumo" oculta `.semana-detalhe`. Se os produtos saírem de
     `#prog-semana-body`, ajustar as regras de print para que:
     - "Imprimir" (resumo completo) continue incluindo os produtos, e
     - "Só resumo" continue ocultando os produtos.
     Provável: aplicar `print-semana`/`print-semana-resumo` de forma que o
     `#tab-produtos` apareça no print completo e seja ocultado no "só resumo".

3. **Faixa de KPIs no topo do resumo**
   - Reposicionar `indicadoresHtml` + `execHtml` numa faixa horizontal compacta no
     topo de `#prog-semana-body` (ou acima da tabela), aproveitando a largura.
   - Reusar as classes `.semana-kpis`/`.semana-kpi` (grid `auto-fit`), só ajustando
     o espaçamento/agrupamento para caberem lado a lado nas telas largas.
   - Não alterar os valores nem a lógica — apenas a disposição visual.

4. **Reduzir rolagem**
   - Revisar margens/altos dos blocos do resumo na **tela** (não na impressão).
   - Opcional: tabela da semana e Dia Crítico abaixo da faixa de KPIs.

## Regras / cuidados
- Não alterar parâmetros de negócio: `TOTAL_MIN`, `FADIGA_PCT`, fator de
  aceleração, fórmula de Cx/min, horários de turno.
- Não alterar nenhum cálculo existente nem a tabela principal.
- Manter `index.html` e `app.html` idênticos.
- Não regredir a impressão A4 (resumo cabendo em 1 folha; títulos sem órfãos;
  barras do gráfico visíveis em P&B).
- Validar a sintaxe do script inline com `node --check` após as edições.
