const STORAGE_KEY = 'guardrail_chat_conversations_v1'

/** @typedef {{ id: string; role: 'user' | 'assistant'; content: string; createdAt: number }} ChatMessage */
/** @typedef {{ id: string; title: string; messages: ChatMessage[]; updatedAt: number }} Conversation */

/** @returns {Conversation[]} */
export function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidConversation)
  } catch {
    return []
  }
}

/** @param {Conversation[]} list */
export function saveConversations(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

/** @param {unknown} x @returns {x is Conversation} */
function isValidConversation(x) {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof /** @type {Conversation} */ (x).id === 'string' &&
    typeof /** @type {Conversation} */ (x).title === 'string' &&
    Array.isArray(/** @type {Conversation} */ (x).messages) &&
    typeof /** @type {Conversation} */ (x).updatedAt === 'number'
  )
}

export function newConversationId() {
  return crypto.randomUUID?.() ?? `c_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function newMessageId() {
  return crypto.randomUUID?.() ?? `m_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

/** @param {Conversation[]} list @returns {string} */
export function serializeExport(list) {
  return JSON.stringify({ version: 1, exportedAt: Date.now(), conversations: list }, null, 2)
}

/** @param {string} json @returns {Conversation[]} */
export function parseImport(json) {
  const data = JSON.parse(json)
  if (data && Array.isArray(data.conversations)) {
    return data.conversations.filter(isValidConversation)
  }
  if (Array.isArray(data)) {
    return data.filter(isValidConversation)
  }
  throw new Error('Invalid backup format')
}
