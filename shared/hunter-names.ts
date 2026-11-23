import { hash32 } from './hash';

export interface PersonName {
  name: string;
  look: 'f' | 'm';
}

// Elenco de Hunter × Hunter. Nomes curtos nas etiquetas; a equipe continua na camisa.
const F = [
  'Biscuit', 'Machi', 'Pakunoda', 'Shizuku', 'Komugi', 'Alluka', 'Canary', 'Melody',
  'Palm', 'Ponzu', 'Menchi', 'Neon', 'Kikyo', 'Cheadle', 'Pyon', 'Gel', 'Cluck',
  'Baise', 'Zazan', 'Tsubone', 'Amane', 'Mito', 'Spinner', 'Leroute',
];
const M = [
  'Gon', 'Killua', 'Kurapika', 'Leorio', 'Hisoka', 'Chrollo', 'Netero', 'Ging',
  'Kite', 'Morel', 'Knov', 'Knuckle', 'Shoot', 'Illumi', 'Silva', 'Zeno', 'Kalluto',
  'Feitan', 'Phinks', 'Shalnark', 'Franklin', 'Nobunaga', 'Uvogin', 'Bonolenov',
  'Kortopi', 'Meruem', 'Shaiapouf', 'Youpi', 'Colt', 'Cheetu', 'Rammot', 'Pariston',
  'Mizaistom', 'Botobai', 'Saiyu', 'Kanzai', 'Saccho', 'Ginta', 'Genthru', 'Razor',
  'Wing', 'Zushi', 'Hanzo', 'Tonpa', 'Satotz', 'Buhara', 'Gotoh', 'Welfin',
];

export const NAME_POOL: readonly PersonName[] = Object.freeze(
  Array.from({ length: Math.max(F.length, M.length) }, (_, i) => [
    ...(F[i] ? [{ name: F[i], look: 'f' as const }] : []),
    ...(M[i] ? [{ name: M[i], look: 'm' as const }] : []),
  ]).flat(),
);

/**
 * Escolhe um nome determinístico para `id`, evitando os já usados.
 * Se o pool esgotar, acrescenta um sufixo numérico ("Gon 2").
 */
export function pickName(id: string, used: ReadonlySet<string>): PersonName {
  const n = NAME_POOL.length;
  const start = hash32(id) % n;
  for (let i = 0; i < n; i++) {
    const cand = NAME_POOL[(start + i) % n];
    if (!used.has(cand.name)) return cand;
  }
  const base = NAME_POOL[start];
  for (let k = 2; ; k++) {
    const name = `${base.name} ${k}`;
    if (!used.has(name)) return { name, look: base.look };
  }
}
