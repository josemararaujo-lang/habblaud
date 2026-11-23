# Habblaud · Glass operacional

Direção autorizada por Josemar em 22/11/2026: aplicar o visual Glass aprovado na prévia a todos os painéis e à esteira.

## Sistema
- Escritório e personagens em pixel art; interface de operação com fonte de sistema do macOS.
- Uma camada de vidro escuro por painel flutuante. Listas e blocos de leitura usam superfícies sólidas discretas, sem blur em cada linha.
- Material, cantos e tipografia em `client/src/ui/glass.css`; paletas e controles em `themes.css`; geometria e estados em `styles.css`.
- Texto principal #f0f5fb, secundário #b2c0d0, foco azul #90ceff. Camisas Claude laranja, Codex azul, Grok preta e Gemini amarela. Nomes Hunter × Hunter abaixo dos avatares.
- Cantos 20 px nas superfícies, 11–13 px nos controles e linhas. Sombra direcional e borda luminosa discreta.
- Preservar estados reais, nomes, ações, seleções, horários e comprovantes. Estado desconhecido nunca vira ociosidade.
- Interfaces estreitas continuam navegáveis; foco visível e fallback opaco com redução de transparência/maior contraste. Movimento reduzido respeitado.
- Diálogos móveis usam o mecanismo Movable, com limites que mantêm cabeçalho e controles na tela. Refluxo por container queries, sem encolher texto até ficar ilegível. A esteira compacta é uma janela não modal dentro do Habblaud; detalhes de auditoria ficam na visualização completa. Posição e tamanho são locais a cada navegador.
- Aparência clara, escura ou automática nas Configurações. Automático acompanha o sistema em tempo real; escolha explícita tem precedência e fica salva no navegador. Cor da interface não altera tema sazonal nem ciclo dia/noite do cenário.
- Modo claro: texto #172c40, secundário #4c6175, foco #075fa8 sobre superfícies claras. Estados usam verde #167344, âmbar #865000 e erro #a8322b. Marcas dos provedores preservam as cores originais em suas próprias bases.

- Etiquetas de projetos usam o mesmo balão de 18 px dos locais. Apenas agentes em `working` ou `shell`, presentes na sala atribuída, acrescentam contorno nas cores das camisas. Equipes simultâneas dividem a borda; pulso de 2,8 s preserva texto estável. Movimento reduzido usa destaque estático.

- Refinamento de leitura em `client/src/ui/refinement.css`: espaçamento de 12–18 px, títulos sem quebra no meio de palavras, metadados de rotina em linha com refluxo, ações da esteira com ícones acessíveis, feed com duas linhas adaptado por container e configurações com opções que cabem na janela. Recibos externos são linhas simples; a prioridade visual permanece nas decisões humanas.

## Evidência e limites
Extensão aos demais painéis: `controls-glass.css` compartilha o acabamento com a esteira. `GlassControls` inclui seleções em grupos segmentados, filtros do feed e estados de trabalho, inclusive grupos criados sob demanda; observadores são liberados na remoção. A seleção do feed exclui o filtro independente de seleção. Painéis têm um plano de leitura sólido, menus abrem por opacidade sem afetar a posição de janelas móveis. Ações perigosas mantêm cor semântica; estados desabilitados, foco e contrastes continuam visíveis.

Refinamento de 23/11: `navigation-glass.css` aplica a referência Glassy Sidebar V10 aprovada na conversa. Uma superfície deslizante acompanha a seleção, sem substituir os botões acessíveis. A esteira usa navegação vertical conectada ao plano de leitura acima de 620 px e horizontal abaixo; expansão dura até 360 ms, sem bloquear interação, e é estática com movimento reduzido. Símbolos de todos os provedores aparecem nas rotinas junto às suas cores. Paletas usam tokens semânticos.

Referências e decisões em `docs/design/liquid-glass.md`. A adaptação web usa blur e translucidez, sem alegar refração nativa. Figma indisponível pelo limite já registrado; a revisão visual é feita no app local real.
