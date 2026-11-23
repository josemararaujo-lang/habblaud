import './style.css';
import { appearanceFromSeed, characterSprite } from '../art';
import { teamUniform } from '../../../shared/team-uniform';
import type { Provider } from '../../../shared/types';
import { tr } from '../../../shared/i18n';

const people = [
  { name: 'Gon', provider: 'Codex', team: 'codex' as Provider, state: tr('Precisa de você'), color: '#9451c4', seed: 42, look: 'm' as const },
  { name: 'Machi', provider: 'Claude Code', team: 'claude' as Provider, state: tr('Trabalhando'), color: '#b45c38', seed: 17, look: 'f' as const },
  { name: 'Killua', provider: 'Grok Bot', team: 'grok-bot' as Provider, state: tr('Estado não informado pelo app'), color: '#657580', seed: 63, look: 'm' as const },
  { name: 'Biscuit', provider: 'Gemini', team: 'gemini' as Provider, state: tr('Estado não informado pelo app'), color: '#2767b8', seed: 28, look: 'f' as const },
];
const icon = (path: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const sun = icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>');
const back = icon('<path d="m15 5-7 7 7 7"/>');
const check = icon('<path d="m6 12 4 4 8-8"/>');
document.body.classList.add('compact');
document.body.innerHTML = `
<header class="toolbar glass"><a class="back" href="/" aria-label="${tr('Voltar ao escritório')}">${back}</a><div class="brand">Habblaud<span>${tr('Prévia visual · Liquid Glass')}</span></div><button class="theme icon-button" aria-label="${tr('Alternar tema claro e escuro')}">${sun}</button></header>
<main>
  <section class="intro"><div><h1>${tr('Nomes e equipes')}</h1><p>${tr('Cores nas camisas, nomes nas etiquetas.')}</p></div><span class="demo-note">${tr('Demonstração · dados ilustrativos')}</span></section>
  <div class="workspace">
    <section class="studio glass" aria-label="${tr('Estudo dos nomes')}">
      <div class="studio-head"><h2>${tr('Nomes dos personagens')}</h2><div class="segmented" role="group" aria-label="${tr('Formato das etiquetas')}"><button data-density="compact" aria-pressed="true">${tr('Compacto')}</button><button data-density="complete" aria-pressed="false">${tr('Completo')}</button></div></div>
      <p class="explanation">${tr('Só o nome na etiqueta. A cor da camisa identifica a equipe. Selecione um personagem.')}</p>
      <div class="people"></div>
      <div class="studio-foot"><span>${tr('Os personagens continuam em pixel art.')}</span><span>${tr('As etiquetas passam a ter leitura de sistema.')}</span></div>
    </section>
    <aside class="inspector glass" aria-live="polite"><div class="inspector-title">${tr('Em foco')}</div><h2 id="person-name"></h2><p id="person-provider"></p><div class="status"><span class="status-dot"></span><span id="person-state"></span></div><p class="hint">${tr('O nome completo permanece disponível. Cor e texto distinguem o estado sem depender apenas do ponto colorido.')}</p><div class="divider"></div><label class="switch"><span>${tr('Mais contraste')}</span><input id="contrast" type="checkbox"><span class="switch-track" aria-hidden="true"></span></label><p class="hint">${tr('Vidro mais sólido para fundos movimentados.')}</p></aside>
  </div>
  <section class="design-notes"><h2>${tr('A mesma linguagem, em todo o Habblaud.')}</h2><div class="notes"><article><h3>${tr('Nomes e salas')}</h3><p>${tr('Etiquetas arredondadas, nomes legíveis e destaque suave para a pessoa selecionada.')}</p></article><article><h3>${tr('Painéis e controles')}</h3><p>${tr('Vidro nos elementos flutuantes. Listas mais sólidas, espaçamento consistente e menos contornos concorrendo.')}</p></article><article><h3>${tr('Movimento e acesso')}</h3><p>${tr('Transições curtas, foco de teclado visível e respeito à redução de transparência e movimento.')}</p></article></div></section>
  <section class="references"><h2>${tr('Referências da Apple')}</h2><a href="https://developer.apple.com/design/human-interface-guidelines/materials" target="_blank" rel="noopener"><strong>Materials · Human Interface Guidelines</strong><span>${tr('Material, profundidade e legibilidade')}</span></a><a href="https://developer.apple.com/videos/play/wwdc2025/219/" target="_blank" rel="noopener"><strong>Meet Liquid Glass · WWDC25</strong><span>${tr('Controles flutuantes e uso moderado do vidro')}</span></a><a href="https://developer.apple.com/design/human-interface-guidelines/typography" target="_blank" rel="noopener"><strong>Typography · Human Interface Guidelines</strong><span>${tr('Hierarquia, peso e clareza dos nomes')}</span></a></section>
  <footer>${tr('Estudo de design. Cores de equipe e nomes compactos aprovados por Josemar. A repaginada geral dos painéis continua em proposta.')}</footer>
</main>`;
let selected = 0;
const list = document.querySelector('.people')!;
for (const [i, p] of people.entries()) {
  const button = document.createElement('button');
  button.className = 'person';
  button.style.setProperty('--person-color', p.color);
  button.setAttribute('aria-label', `${p.name} · ${p.provider} · ${p.state}`);
  button.setAttribute('aria-pressed', String(i === 0));
  const sprite = characterSprite({ appearance: appearanceFromSeed(p.seed, { look: p.look, parts: teamUniform(p.team) }), dir: 'down', pose: 'stand', frame: 0 });
  const avatar = document.createElement('canvas'); avatar.width = sprite.canvas.width * 4; avatar.height = sprite.canvas.height * 4;
  const context = avatar.getContext('2d')!; context.imageSmoothingEnabled = false; context.drawImage(sprite.canvas, 0, 0, avatar.width, avatar.height);
  avatar.className = 'avatar'; avatar.setAttribute('aria-hidden', 'true');
  button.append(avatar);
  const label = document.createElement('span'); label.className = 'name-tag';
  const name = document.createElement('strong'); name.textContent = p.name;
  const provider = document.createElement('span'); provider.className = 'provider'; provider.textContent = p.provider;
  const mark = document.createElement('span'); mark.className = 'selection-mark'; mark.innerHTML = check;
  label.append(name, provider, mark); button.append(label);
  button.addEventListener('click', () => select(i)); list.append(button);
}
function select(index: number) {
  selected = index;
  for (const [i, button] of Array.from(list.children).entries()) button.setAttribute('aria-pressed', String(i === selected));
  const p = people[index];
  document.querySelector('#person-name')!.textContent = p.name;
  document.querySelector('#person-provider')!.textContent = p.provider;
  document.querySelector('#person-state')!.textContent = p.state;
  document.querySelector('.status')!.classList.toggle('attention', index === 0);
  document.querySelector('.status')!.classList.toggle('unknown', index > 1);
}
select(0);
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-density]')) button.addEventListener('click', () => {
  document.body.classList.toggle('compact', button.dataset.density === 'compact');
  for (const option of document.querySelectorAll('[data-density]')) option.setAttribute('aria-pressed', String(option === button));
});
document.querySelector('.theme')!.addEventListener('click', () => document.body.classList.toggle('dark'));
document.querySelector('#contrast')!.addEventListener('change', e => document.body.classList.toggle('contrast', (e.target as HTMLInputElement).checked));
if (matchMedia('(prefers-color-scheme: dark)').matches) document.body.classList.add('dark');
