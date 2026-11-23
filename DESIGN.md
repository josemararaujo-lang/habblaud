# Habblaud · Glass operacional

Direção autorizada por Josemar em 22/11/2026: aplicar o visual Glass aprovado na prévia a todos os painéis e à esteira.

## Sistema
- Escritório e personagens em pixel art; interface de operação com fonte de sistema do macOS.
- Uma camada de vidro escuro por painel flutuante. Listas e blocos de leitura usam superfícies sólidas discretas, sem blur em cada linha.
- Tokens, material, cantos e tipografia centralizados em `client/src/ui/glass.css`; geometria e estados em `styles.css`.
- Texto principal #f0f5fb, secundário #b2c0d0, foco azul #90ceff. Camisas Claude laranja, Codex azul, Grok preta e Gemini amarela. Nomes Hunter × Hunter abaixo dos avatares.
- Cantos 20 px nas superfícies, 11–13 px nos controles e linhas. Sombra direcional e borda luminosa discreta.
- Preservar estados reais, nomes, ações, seleções, horários e comprovantes. Estado desconhecido nunca vira ociosidade.
- Interfaces estreitas continuam navegáveis; foco visível e fallback opaco com redução de transparência/maior contraste. Movimento reduzido respeitado.

## Evidência e limites
Referências e decisões em `docs/design/liquid-glass.md`. A adaptação web usa blur e translucidez, sem alegar refração nativa. Figma indisponível pelo limite já registrado; a revisão visual é feita no app local real.
