# Proposta visual · Liquid Glass

Estado: aplicação geral autorizada por Josemar em 22/11/2026, incluindo os painéis operacionais e a esteira. Nomes compactos e equipes pela camisa permanecem.
Superfície: Operate. A pessoa veio reconhecer agentes e decidir; decoração não deve ocultar estados.
Direção vinculada ao pedido de Josemar de 22/11/2026: Apple / Glass, começando pelos nomes dos personagens. A direção e a primeira experiência foram nomeadas no pedido; não há sorteio de estilos concorrentes.

## Referências primárias
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials): material para controles e navegação, com legibilidade.
- [Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/): formas flutuantes, separação da camada de conteúdo e evitar vidro sobre vidro.
- [Typography](https://developer.apple.com/design/human-interface-guidelines/typography): hierarquia tipográfica.

## Primeira intervenção: nomes
Fonte de sistema do Mac, peso 650, tamanho legível independente da fonte pixelada. Na interface operacional, somente o nome abaixo do personagem; provedor e estado permanecem nos detalhes. A prévia mantém a comparação com duas linhas. Seleção indicada por marca de verificação e contorno azul. Sem renomear pessoas ou inferir estados. Personagens do estudo são exemplos ilustrativos; os avatares vêm do módulo de arte existente.

Josemar respondeu escolhendo cores das camisas para economizar espaço e somente os nomes nas etiquetas: Claude laranja, Codex azul, Grok preta e Gemini amarela. Na autorização seguinte, em 22/11, ampliou o Glass aos painéis e à esteira. As cores são projeção visual, preservando as personalizações armazenadas de cabelo, pele e acessórios.

## Alcance da repaginada
1. Etiquetas de pessoas e títulos de salas.
2. Barra superior e filtros: um plano flutuante, agrupamentos mais claros e menos contornos.
3. Painéis e gavetas: superfície mais sólida para conteúdo denso, estado destacado por texto e cor.
4. Movimento: feedback curto e interrompível; respeitar redução de movimento, transparência e maior contraste.

Não aplicar vidro em todas as linhas nem empilhar cartões translúcidos. O conteúdo continua sendo o escritório em pixel art. A adaptação web usa translucidez e blur; não reproduz a refração nativa do sistema Apple.

## Aplicação operacional
`client/src/ui/glass.css` concentra o acabamento do escritório real: barra, lateral, gaveta, feed, configurações, ajuda, histórico, Meu dia e esteira. Vidro escuro nas superfícies flutuantes; conteúdo denso em bases mais sólidas. Fonte de sistema, controles com foco visível, estados preservados e fallback opaco para maior contraste/redução de transparência.

## Prévia e revisão
`/glass-preview.html`: seleção de personagem, modos compacto/completo, tema e controle de contraste. Breakpoints 700px e 900px. Sem alteração nas sessões, preferências do escritório, mensagens ou tarefas.

Figma: arquivo de estudo criado, mas leitura/edição bloqueadas pelo limite MCP do plano Starter antes de montar quadros. Não há tela aprovada no arquivo nem evidência visual produzida no Figma. A prévia local permite revisão concreta da proposta sem contornar a restrição do Figma.
