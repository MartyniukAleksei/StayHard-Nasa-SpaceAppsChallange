// NASA photo numbers (iss024e008350, iss024e008351 …) run in bursts of near-identical shots.

const number = (name: string) => {
  const m = /^(iss\d+)e0*(\d+)/i.exec(name);
  return m ? { roll: m[1].toLowerCase(), n: Number(m[2]) } : null;
};

/** First photo of each burst: a new burst starts when the roll changes or the number jumps by more than `gap`. */
export function onePerBurst<T extends { name: string }>(photos: T[], gap = 30): T[] {
  let prev: { roll: string; n: number } | null = null;
  return photos.filter((p) => {
    const cur = number(p.name);
    const fresh = !cur || !prev || cur.roll !== prev.roll || cur.n - prev.n > gap;
    if (cur) prev = cur;
    return fresh;
  });
}
