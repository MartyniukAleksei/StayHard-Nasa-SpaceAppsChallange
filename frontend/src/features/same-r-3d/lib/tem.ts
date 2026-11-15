/** Low-magnification grid overview (e.g. "340x", "195x" in the file name): the copper mesh, not particles. */
export const isGridOverview = (name: string) => /(?:^|[\s_])\d{2,3}\s?x(?:\.|\s|$)/i.test(name);

/** Images with particles first, the grid overview last; stable otherwise. */
export const particlesFirst = <T extends { name: string }>(images: T[]): T[] => [
  ...images.filter((i) => !isGridOverview(i.name)),
  ...images.filter((i) => isGridOverview(i.name)),
];
