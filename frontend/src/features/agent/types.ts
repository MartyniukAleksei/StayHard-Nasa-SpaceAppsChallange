// Типи дзеркалять SSE-контракт бекенду (backend/src/flame/agent, docs/agent/README.md).

export type Source = { n: number; url: string; title: string; quotes: string[] };
export type Segment = { text: string; cites: number[]; general: boolean; uncited: boolean };
export type Answer = { segments: Segment[]; sources: Source[] };

export type ExplorerParams = Partial<Record<"fuel" | "diluent" | "pressure" | "o2" | "fiber" | "end" | "tag", string[]>>;
export type Proposal = {
  id: string;
  action: "open_tests" | "open_test" | "open_compare";
  label: string;
  params: { test_nos?: number[]; explorer?: ExplorerParams };
};
export type Highlight = { fields: string[]; test_nos: number[] };
export type Notice = { reason: string; message: string };

export type AgentEvent =
  | { event: "text_start"; data: Record<string, never> }
  | { event: "text_delta"; data: { text: string } }
  | { event: "status"; data: { tool: string; text: string } }
  | { event: "usage"; data: { cost_usd: number } }
  | { event: "rewrite"; data: { reason: string } }
  | { event: "limit"; data: Notice }
  | { event: "error"; data: Notice }
  | { event: "proposal"; data: Proposal }
  | { event: "highlight"; data: Highlight }
  | { event: "done"; data: { answer: Answer; cost_usd: number; duration_s: number } };

export type PageContext = {
  route: string;
  test_no?: number;
  ids?: number[];
  explorer?: ExplorerParams;
};

/** Репліка для запиту: стисла історія (текст + джерела), як очікує POST /api/agent. */
export type HistoryTurn = {
  role: "user" | "assistant";
  text: string;
  sources?: { n: number; url: string; title: string }[];
  page_context?: PageContext;
};

export type UserItem = { id: string; role: "user"; text: string; context: PageContext };
export type AssistantItem = {
  id: string;
  role: "assistant";
  live: string; // текст, що стрімиться зараз
  status: string | null;
  answer: Answer | null;
  proposals: Proposal[];
  notices: Notice[];
  done: boolean;
};
export type ChatItem = UserItem | AssistantItem;
