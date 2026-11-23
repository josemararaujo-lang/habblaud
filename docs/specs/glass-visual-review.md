# Revisão visual completa · Glass

Rodada de 23/11/2026, continuação do PR #2, autorizada por Josemar. Preservar a direção aprovada e os dados reais.

Achados e refinamentos:
- Em 390 px, a barra superior quebra em três linhas dentro de 92 px e corta o botão lateral (topo observado em -14,5 px). Tornar a ação de focar salas compacta e garantir espaço para todas as linhas sem cortar controles.
- Normalizar o estado `aria-checked` dos botões de escolha de personagem e excluir controles `aria-disabled` dos efeitos de pressionar/hover.
- Menus longos perdem o cabeçalho ao rolar até Idioma/Dados; manter título, restauração e fechamento fixos durante a rolagem.
- Harmonizar ações menores, metadados, quebras de palavras, cabeçalhos e áreas de leitura, sem apagar informação nem trocar os textos factuais.

Cobertura: barra, sidebar Agora/Salas, feed, Configurações (início e fim), ajuda, Meu dia, esteira completa/compacta e detalhes de agente; claro/escuro em 1280, 768, 390 e 320 px. Histórico/terminal e edição de personagem dependem de recursos locais indisponíveis nesta sessão; conferir estilos e limites em código sem ampliar permissões. Figma mantém a limitação já documentada em docs/design/liquid-glass.md.

Validação: build, typecheck, testes direcionados, revisão cruzada, Semgrep e screenshots locais sem dados de conversas para entrega. Sem merge nem deploy.

## Resultado da revisão

- Barra sem botões cortados em 320, 390, 768 e 1280 px. Em 320/390, a altura permanece em 92 px; ícone Focar salas mantém o nome acessível.
- Configurações até Idioma/Dados: grupos de 3/4/5 opções sem overflow; cabeçalho permanece acessível e há margem de rolagem para o foco do teclado.
- Ajuda, Meu dia, detalhes, salas, feed e esteira revisados nos dois temas, complementando a rodada anterior. Filtros de escopo e modo do feed continuam independentes.
- 26 testes direcionados aprovados (viewport, movable, color-mode, prefs), typecheck e build do cliente aprovados. Semgrep: 74 regras, zero achados no TypeScript alterado; detector estático sem achados. Revisão cruzada corrigiu precedência das regras de aria-disabled e de espaçamento em 320 px.
- Evidência visual local: ajuda-clara.jpg, ajuda-escura.jpg e menu-claro-320.jpg em /Users/jobs/.codex/visualizations/habblaud-glass-review/. Preferências temporárias restauradas.
- Limite: histórico/terminal e editor de personagem não puderam ser exercitados na UI por indisponibilidade das capacidades locais; sem alteração de permissões. A suíte completa da branch não foi reexecutada.
