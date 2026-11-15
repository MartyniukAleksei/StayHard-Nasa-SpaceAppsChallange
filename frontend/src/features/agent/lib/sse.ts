// Парсер Server-Sent Events із довільних шматків тексту (fetch + ReadableStream).
// Самодостатній модуль (без "@/"-імпортів), щоб працював під node --test.

export type RawEvent = { event: string; data: unknown };

export function createSseParser(onEvent: (e: RawEvent) => void) {
  let buf = "";
  const emit = (block: string) => {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (!data.length) return;
    const raw = data.join("\n");
    let parsed: unknown = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* не JSON — віддаємо як рядок */
    }
    onEvent({ event, data: parsed });
  };
  return {
    feed(chunk: string) {
      buf += chunk.replace(/\r\n/g, "\n");
      let i: number;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        emit(buf.slice(0, i));
        buf = buf.slice(i + 2);
      }
    },
    flush() {
      if (buf.trim()) emit(buf);
      buf = "";
    },
  };
}
