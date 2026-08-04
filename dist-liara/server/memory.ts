interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const MAX_HISTORY = 30;

const conversations = new Map<string, ConversationEntry[]>();

export function getHistory(sessionId: string): ConversationEntry[] {
  return conversations.get(sessionId) ?? [];
}

export function addToHistory(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
) {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, []);
  }

  const history = conversations.get(sessionId)!;
  history.push({ role, content, timestamp: Date.now() });

  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

export function clearHistory(sessionId: string) {
  conversations.delete(sessionId);
}

export function buildMessageHistory(
  sessionId: string
): { role: string; content: string }[] {
  return getHistory(sessionId).map(({ role, content }) => ({ role, content }));
}
