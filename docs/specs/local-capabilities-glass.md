# Histórico, terminal e editor local

Josemar autorizou em 23/11/2026 resolver a indisponibilidade e revisar os três recursos em claro/escuro. Continuação do PR #2, preservando a direção Glass aprovada.

## Causa confirmada e correção local

O LaunchAgent `com.habblaud.server` iniciava com `HABBLAUD_HOST=127.0.0.1` e `HABBLAUD_TERMINAL=0`. Esta opção desliga o leitor de conversas, histórico e a edição de personagem. Foi alterada para `1`, com backup local privado da configuração e reinício do serviço. O servidor permanece exclusivamente em loopback. `HABBLAUD_MENSAGENS=0` preservado; PTY/criação de agentes permanecem desativados. A chave do terminal também habilita o registro local de permissões existente, sem responder automaticamente a pedidos.

Após o reinício: `/api/access` confirmou local=true, terminal=true, messages=false, spawn=false, remote=false. `/api/health` confirmou pty=false. `/api/sessions/recent` retornou 150 sessões reais. Busca do histórico e leitura da sessão Codex atual conferidas na interface.

## Refinamento visual

O terminal ainda usava fundo preto fixo e cores de texto incompatíveis com o modo claro. Aplicar tokens semânticos aos textos, parâmetros, resultados, diffs, busca e rodapé; preservar cores de estado e fonte monoespaçada do conteúdo. Cabeçalho Glass com linha discreta. Histórico com lista legível; editor inline sem uma segunda camada de blur, mantendo cores das amostras e equipes. Revisar filtros e telas estreitas. Nenhum envio de mensagem, execução de shell, aprovação de permissão ou alteração de personagem para testar.

## Validação e pendência

- Configuração persistente do LaunchAgent: terminal=1, bind 127.0.0.1, mensagens=0 e PTY desativado. Serviço reativado e API de saúde consultada novamente. Host não local foi recusado com 403 em requisição HTTP com Host explícito.
- Histórico abriu, listou 150 sessões, filtrou por projeto e abriu a conversa Codex atual antes da indisponibilidade da ferramenta de UI. O snapshot atual e a função canEditCharacter confirmaram autorização do editor para o agente principal real.
- 64 testes direcionados passaram: 59 de terminal, histórico, acesso, modelo do editor e filtros; 5 de gravação/validação de personagem em fixtures isoladas. Nenhum personagem real foi alterado. Typecheck e build aprovados.
- Revisão cruzada consolidou uma única folha terminal-glass.css e corrigiu contraste de Copiar, blocos Markdown e estado de falha. Detector estático sem achados.
- Pendente: abrir o editor e conferir o novo acabamento renderizado em claro/escuro e janela estreita. O controle CUA foi removido durante esta execução; não foi substituído por automação de navegador fora do mecanismo autorizado. Não afirmar revisão visual concluída nem produzir captura simulada como prova.
