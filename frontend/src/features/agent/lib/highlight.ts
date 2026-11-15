// Підсвічування параметрів на сторінці: сторінки позначають значення атрибутами
// data-field="p_atm" (кілька — через пробіл) і data-test="19" на контейнері тесту.
// Фіча agent лише додає клас — жодних імпортів зі сторінок.

export const HL_CLASS = "ag-hl";

export function clearHighlight(root: ParentNode = document): void {
  root.querySelectorAll(`.${HL_CLASS}`).forEach((el) => el.classList.remove(HL_CLASS));
}

export function applyHighlight(fields: string[], testNos: number[], root: ParentNode = document): Element[] {
  clearHighlight(root);
  const scope = root.querySelector("main") ?? root;
  const hits: Element[] = [];
  for (const f of fields) {
    scope.querySelectorAll(`[data-field~="${CSS.escape(f)}"]`).forEach((el) => {
      const owner = el.closest("[data-test]")?.getAttribute("data-test");
      if (testNos.length && owner && !testNos.includes(Number(owner))) return;
      el.classList.add(HL_CLASS);
      hits.push(el);
    });
  }
  return hits;
}
