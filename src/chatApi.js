/**
 * Request body for guardrails chat completions (OpenAI-compatible messages).
 * User text from the page is sent as the last user message `content` (replaces the former fixed "你好呀").
 *
 * @param {{ role: string; content: string }[]} messages
 * @returns {{ guardrails: { config_id: string }; model: string; messages: { role: string; content: string }[] }}
 */
export function buildChatRequestPayload(messages) {
  const configId =
    import.meta.env.CHAT_GUARDRAILS_CONFIG_ID?.trim() ||
    import.meta.env.VITE_GUARDRAILS_CONFIG_ID?.trim() ||
    'mybot'
  const model =
    import.meta.env.CHAT_MODEL?.trim() ||
    import.meta.env.VITE_CHAT_MODEL?.trim() ||
    'llama3.2'

  return {
    guardrails: { config_id: configId },
    model,
    messages,
  }
}

/**
 * Read assistant text from chat.completion JSON: choices[0].message.content
 * @param {unknown} data
 * @returns {string | undefined}
 */
export function parseChatCompletionContent(data) {
  if (!data || typeof data !== 'object') return undefined
  const choices = /** @type {Record<string, unknown>} */ (data).choices
  if (!Array.isArray(choices) || choices.length === 0) return undefined
  const first = choices[0]
  if (!first || typeof first !== 'object') return undefined
  const message = /** @type {Record<string, unknown>} */ (first).message
  if (!message || typeof message !== 'object') return undefined
  const content = /** @type {Record<string, unknown>} */ (message).content
  return typeof content === 'string' ? content : undefined
}

/**
 * POST JSON to CHAT_API_URL
 * @param {{ role: string; content: string }[]} messages
 * @returns {Promise<string>}
 */
export async function sendChat(messages) {
  const url =
    import.meta.env.CHAT_API_URL?.trim() || import.meta.env.VITE_CHAT_API_URL?.trim()

  if (!url) {
    await delay(450)
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    return `[演示模式] 尚未配置 CHAT_API_URL。请在 .env 中设置。\n\n你刚才说：${lastUser?.content ?? '（空）'}`
  }

  const payload = buildChatRequestPayload(messages)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(text || `Request failed (${res.status})`)
  }

  const trimmed = text.trim()
  if (!trimmed) return ''

  let data
  try {
    data = JSON.parse(trimmed)
  } catch {
    return trimmed
  }

  const content = parseChatCompletionContent(data)
  if (content !== undefined) return content

  throw new Error(trimmed.slice(0, 500) || 'Response missing choices[0].message.content')
}

/** @param {number} ms */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
