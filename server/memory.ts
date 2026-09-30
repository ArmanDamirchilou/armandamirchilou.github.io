interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const MAX_HISTORY = 30;
const MAX_SESSIONS = 500;

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
    // Every visitor gets a session and nothing expires them, so cap the total;
    // Map keeps insertion order, so the first key is the oldest session.
    if (conversations.size >= MAX_SESSIONS) {
      conversations.delete(conversations.keys().next().value!);
    }
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
