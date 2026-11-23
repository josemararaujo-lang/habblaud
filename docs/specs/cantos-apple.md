# Cantos concêntricos no Glass

Pedido: aplicar a skill local cantos-apple ao Habblaud, preservando os temas e a identidade dos agentes.
Referência visual: Reel https://www.instagram.com/reel/Df8EKwxxL0P/ e acabamento Glass existente. Habblaud não consta no índice Figma nem nos projetos atuais do Habitvs; esta rodada refina a geometria existente, sem criar telas ou fluxos.

## Mapa e plano

| Relação | Medida anterior observada | Ajuste |
| --- | --- | --- |
| Barra: grupo → controles | 14 / borda 1 + padding 3 / controles 10, Esteira 12 | Unificar controle próximo em 10, derivado de 14 − 4 |
| Agora/Salas | trilho 12 / borda 1 + padding 3 / botão 8, seleção 10 | Seleção acompanha o raio efetivo do botão |
| Opções de Configurações | trilho 13 / borda 1 + padding 4 / botão 8, seleção 10 | Derivar 8; seleção e botão têm a mesma curva |
| Feed | trilho 13 / borda 1 + padding 4 / botão 10 | Mesmo cálculo 8; manter chips independentes |
| Esteira ampla | casca 24 / borda 1 + margem 10 / conteúdo 16 | Conteúdo 13; navegação lateral continua conectada |
| Esteira compacta | margem 6, conteúdo 16 | Conteúdo 17 (casca 24) ou 13 (casca 20 em tela estreita) |
| Esteira compacta: filtros | trilho 12 / borda 0 + padding 3 / controles 9 | Já coerente: preservar 9 |
| Cabeçalhos e rodapés de painéis | raio interno fixo 19; casca móvel 20 ou 17 | Derivar casca − borda 1, inclusive no modo estreito |
| Renomear sala | casca 14 / borda 1 + padding 14 / campo 10 | Ampliar apenas o raio externo para 25; preservar área útil |
| Sala → cabeçalho | 13 / borda 1 / 12 | Já coerente: preservar |
| Cartões, chips e editor | distâncias assimétricas ou controles afastados | Manter raios próprios; não impor fórmula universal |

## Critério de pronto

Raios ligados aos afastamentos reais; seleção móvel acompanha seu botão; leitura, foco e alvos preservados. Conferir claro/escuro, janela compacta e viewport estreita; validar tipos, build e testes. Sem alterações em dados, provedores, agenda ou permissões.

## Validação — 23/11/2026

- Navegador: Configurações e lateral em claro/escuro; seleção e botão com raio 8, trilho 13 e afastamento 5. Agora/Salas: trilho 12, afastamento 4, raio interno 8.
- Esteira real aberta: casca 24, margem 10 e borda 1, conteúdo externo 13. Em viewport 390×844: casca 20, margem 6 e borda 1, conteúdo 13; filtros compactos com raio 12/9. Conteúdo e filtros sem overflow horizontal. Preferência de cor devolvida a Automático e viewport restaurado.
- Painel estreito: casca 17, cabeçalho 16. Capturas compartilháveis usam somente simulação do navegador.
- Typecheck, build e 19 testes direcionados aprovados. Revisão cruzada estática sem achados.
- Suíte completa: 1.943 passaram, 2 ignorados, 2 falharam. As mesmas duas falhas foram reproduzidas restaurando temporariamente glass-selection.ts de HEAD: mock DOM incompleto em client/src/ui/timelapse.test.ts e timeout de tema em server/world/uplink.test.ts. Correções desses testes ficam fora desta rodada de geometria; nenhuma alteração em World.
