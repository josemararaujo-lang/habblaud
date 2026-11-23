# Glass em painéis e controles

Josemar autorizou em 23/11/2026 estender o acabamento aprovado da navegação e da esteira ao restante da interface. Continuação do PR #2 e da referência Glassy Sidebar V10. Figma mantém a limitação registrada em docs/design/liquid-glass.md; aprovação visual dada diretamente na conversa.

Escopo: material único nos painéis, menus, dicas e diálogos; plano de leitura mais sólido; botões e campos com estados consistentes; seleção deslizante nos controles segmentados, feed e filtros de trabalho. Preservar semântica, ações, cores dos provedores e alertas. Movimento não interfere no arraste, resize, foco nem terminal. Redução de movimento/transparência e maior contraste têm alternativas estáticas/opacas.

Critério: revisar Configurações (inclusive grupos de 4/5 opções), Meu dia, ajuda, gaveta de agente e feed nos dois temas e janela estreita. Build, typecheck, testes direcionados, revisão cruzada e Semgrep. Não modificar execução de agentes, rotinas ou dados.
