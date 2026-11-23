# Refino do Habblaud: espaço e leitura

Pedido: aproveitar melhor a tela, textos, quebras de linha, acabamento, organização, UI e UX, preservando Glass e pixel art.

Evidência atual: esteira de 360 px gasta duas linhas de cabeçalho com ações; no modo completo, dono, recorrência e próximo horário ficam em linhas isoladas; feed usa elipse de uma linha mesmo com conteúdo relevante; grupos de opções e nomes longos precisam respeitar a largura do painel, inclusive quando redimensionado em desktop.

Implementação: ações de atualizar/fechar com ícones e nomes acessíveis, cabeçalho sem palavras partidas; metadados de rotina agrupados e comprovantes sob demanda; bordas e espaçamento mais calmos, texto com quebra por palavra e caminhos com quebra emergencial; feed com duas linhas e adaptação por container; controles das configurações e títulos dos detalhes responsivos; estados e horários reais inalterados.

Validação: typecheck, testes de UI/escritório, build, revisão no app a 1440 px e 434 px, modos claro/escuro e janela compacta. Figma está indisponível pelo limite já registrado no DESIGN.md; referência visual é o Glass existente aprovado pelo Josemar e a interface local.
