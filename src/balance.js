// Répartit des joueurs (avec un niveau de 1 à 5) en k équipes de force équivalente.
// Recherche aléatoire + améliorations par échanges : chaque appel donne un tirage différent,
// choisi parmi les meilleures répartitions trouvées.
const shuffle = (a, r) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function balance(players, k, r = Math.random) {
  const n = players.length;
  const score = (T) => {
    const avg = T.map((t) => (t.length ? t.reduce((s, p) => s + p.level, 0) / t.length : 0));
    const mean = avg.reduce((s, x) => s + x, 0) / k;
    return avg.reduce((s, x) => s + (x - mean) ** 2, 0);
  };
  const found = [];
  for (let it = 0; it < 150; it++) {
    const sizes = shuffle(Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0)), r);
    const p = shuffle(players, r);
    const T = [];
    let o = 0;
    sizes.forEach((s) => { T.push(p.slice(o, o + s)); o += s; });
    let cur = score(T);
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++)
        for (let x = 0; x < T[i].length; x++) for (let y = 0; y < T[j].length; y++) {
          [T[i][x], T[j][y]] = [T[j][y], T[i][x]];
          const s = score(T);
          if (s < cur - 1e-9) { cur = s; improved = true; }
          else [T[i][x], T[j][y]] = [T[j][y], T[i][x]];
        }
    }
    found.push({ T: T.map((t) => t.map((q) => q.name)), s: cur });
  }
  const min = Math.min(...found.map((f) => f.s));
  const good = found.filter((f) => f.s <= min + 0.03 + min * 0.2);
  return good[Math.floor(r() * good.length)].T;
}
