# Menus, controles e aparência

Pedido de Josemar em 22/11/2026: revisar menus e botões e oferecer interface clara e escura.

## Revisão aplicada
- Barra e botões de ícone: mesma família de cantos, foco visível, estados pressionado, expandido e desabilitado. Ícones dos provedores preservados.
- Navegação, filtros do feed, da esteira e seletores das Configurações: mesma tipografia, altura mínima e seleção por contraste e texto, sem depender só de cor.
- Campos de busca, renomeação, opções e texto: fundos e bordas derivados da paleta; foco azul legível nos dois modos.
- Interruptores: forma arredondada, posição do controle e estado acessível mantidos. Desabilitado continua sem permitir a ação.
- Salas, agentes, detalhes, diálogos, Ajuda, Meu dia e esteira: texto principal/secundário e cores de estado sem cores claras fixas sobre fundo branco.
- Erros, espera, andamento e conclusão preservam o significado; uma versão disponível não é apresentada como erro.

## Aparência
`colorMode` é uma preferência local validada: auto/light/dark. `ColorMode` resolve a escolha, atualiza a raiz imediatamente e acompanha mudanças do sistema no modo automático. A opção não é transmitida como tema do cenário nem altera agentes, horários ou tarefas. Paletas e controles estão em `client/src/ui/themes.css`.

## Conferência
Revisão visual nas Configurações, lateral, salas, campo de renomeação, detalhes, esteira, Ajuda e Meu dia; janelas estreitas e tela ampla, claro e escuro. Preferência salva e seleção por teclado verificadas. Controles de recursos indisponíveis permanecem desabilitados; não foram ativadas integrações, sessões ou permissões para testar aparência. Testes cobrem persistência, migração de preferências antigas, resolução automática e independência do cenário.
