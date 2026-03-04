export interface ConversationTurn {
  userMessage: string;
  assistantReply: string;
}

const MAX_HISTORY = 6; // last 6 exchanges per user

const store = new Map<string, ConversationTurn[]>();

export function getHistory(userId: string): ConversationTurn[] {
  return store.get(userId) ?? [];
}

export function addToHistory(userId: string, turn: ConversationTurn): void {
  const history = store.get(userId) ?? [];
  history.push(turn);
  if (history.length > MAX_HISTORY) history.shift();
  store.set(userId, history);
}

export function clearHistory(userId: string): void {
  store.delete(userId);
}
