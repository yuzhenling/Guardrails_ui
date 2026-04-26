import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { sendChat } from './chatApi.js'
import {
  loadConversations,
  newConversationId,
  newMessageId,
  parseImport,
  saveConversations,
  serializeExport,
} from './chatStorage.js'
import './ChatApp.css'

const GUARDRAILS_CONFIG_IDS = [
  'execution_demo',
  'retrieval_demo',
  'dialog_demo',
  'input_demo',
  'output_demo',
  'mybot',
]

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function IconPanel() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="7" height="16" rx="1" />
      <path d="M14 8h7M14 12h7M14 16h5" />
    </svg>
  )
}

function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" opacity="0.85">
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2V5z" />
    </svg>
  )
}

function IconPencil() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4h8v2m-9 4v10h10V10" />
    </svg>
  )
}

function IconRefresh() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-6.36-2.64M3 12a9 9 0 0 1 9-9 9 9 0 0 1 6.36 2.64M3 3v7h7M21 21v-7h-7" />
    </svg>
  )
}

function IconSend() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-4 3.5-6 7-6s7 2 7 6" />
    </svg>
  )
}

function IconImport() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 15V3M8 7l4-4 4 4M5 21h14" />
    </svg>
  )
}

function IconExport() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12M8 11l4 4 4-4M5 21h14" />
    </svg>
  )
}

/** @param {{ messages: import('./chatStorage.js').ChatMessage[] }} p */
function apiPayload(p) {
  return p.messages
    .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content.trim()))
    .map((m) => ({ role: m.role, content: m.content }))
}

/** @param {import('./chatStorage.js').Conversation[]} list @param {string} id */
function patchConversation(list, id, fn) {
  return list.map((c) => (c.id === id ? fn(c) : c))
}

function createInitialChatState() {
  const list = loadConversations()
  if (list.length > 0) return { conversations: list, activeId: list[0].id }
  const id = newConversationId()
  return {
    conversations: [{ id, title: '新对话', messages: [], updatedAt: Date.now() }],
    activeId: id,
  }
}

export default function ChatApp() {
  const init = useMemo(() => createInitialChatState(), [])
  const [conversations, setConversations] = useState(init.conversations)
  const [activeId, setActiveId] = useState(init.activeId)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [selectedConfigId, setSelectedConfigId] = useState(() => {
    const fromEnv =
      import.meta.env.CHAT_GUARDRAILS_CONFIG_ID?.trim() ||
      import.meta.env.VITE_GUARDRAILS_CONFIG_ID?.trim() ||
      'mybot'
    return GUARDRAILS_CONFIG_IDS.includes(fromEnv) ? fromEnv : 'mybot'
  })
  const importRef = useRef(null)

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  )

  useEffect(() => {
    saveConversations(conversations)
  }, [conversations])

  const upsertMessages = useCallback((conversationId, messages) => {
    setConversations((prev) =>
      patchConversation(prev, conversationId, (c) => ({
        ...c,
        messages,
        updatedAt: Date.now(),
        title:
          c.title === '新对话' && messages.find((m) => m.role === 'user')
            ? (messages.find((m) => m.role === 'user')?.content ?? c.title).slice(0, 48) ||
              c.title
            : c.title,
      })),
    )
  }, [])

  const runAssistant = useCallback(
    async (conversationId, messages) => {
      setIsSending(true)
      try {
        const text = await sendChat(apiPayload({ messages }), { configId: selectedConfigId })
        const assistantId = newMessageId()
        upsertMessages(conversationId, [
          ...messages,
          { id: assistantId, role: 'assistant', content: text, createdAt: Date.now() },
        ])
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e)
        upsertMessages(conversationId, [
          ...messages,
          {
            id: newMessageId(),
            role: 'assistant',
            content: `Error: ${err}`,
            createdAt: Date.now(),
          },
        ])
      } finally {
        setIsSending(false)
      }
    },
    [upsertMessages, selectedConfigId],
  )

  const handleSend = useCallback(async () => {
    const text = draft.trim()
    if (!text || !active || isSending) return

    const userMsg = {
      id: newMessageId(),
      role: /** @type {'user'} */ ('user'),
      content: text,
      createdAt: Date.now(),
    }
    const next = [...active.messages, userMsg]
    upsertMessages(active.id, next)
    setDraft('')
    await runAssistant(active.id, next)
  }, [draft, active, isSending, upsertMessages, runAssistant])

  const handleRegenerate = useCallback(async () => {
    if (!active || isSending) return
    const { messages } = active
    if (messages.length === 0) return

    let base = messages
    if (base[base.length - 1].role === 'assistant') {
      base = base.slice(0, -1)
      upsertMessages(active.id, base)
    }
    if (base.length === 0) return
    if (base[base.length - 1].role !== 'user') return
    await runAssistant(active.id, base)
  }, [active, isSending, upsertMessages, runAssistant])

  const canRegenerate =
    !!active &&
    active.messages.length > 0 &&
    !isSending &&
    active.messages.some((m) => m.role === 'user')

  const handleNew = () => {
    const id = newConversationId()
    setConversations((prev) => [
      { id, title: '新对话', messages: [], updatedAt: Date.now() },
      ...prev,
    ])
    setActiveId(id)
    setDraft('')
  }

  const handleDelete = (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Delete this conversation?')) return
    const next = conversations.filter((c) => c.id !== id)
    if (next.length === 0) {
      const nid = newConversationId()
      setConversations([
        { id: nid, title: '新对话', messages: [], updatedAt: Date.now() },
      ])
      setActiveId(nid)
      return
    }
    setConversations(next)
    if (activeId === id) setActiveId(next[0].id)
  }

  const startRename = (c, e) => {
    e.stopPropagation()
    setEditingId(c.id)
    setRenameValue(c.title)
  }

  const commitRename = () => {
    if (!editingId) return
    const v = renameValue.trim() || 'Untitled'
    setConversations((prev) =>
      prev.map((c) => (c.id === editingId ? { ...c, title: v, updatedAt: Date.now() } : c)),
    )
    setEditingId(null)
  }

  const handleClearAll = () => {
    if (!window.confirm('Clear all conversations?')) return
    const id = newConversationId()
    setConversations([{ id, title: '新对话', messages: [], updatedAt: Date.now() }])
    setActiveId(id)
  }

  const handleExport = () => {
    const blob = new Blob([serializeExport(conversations)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `guardrail-chats-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleImportPick = () => importRef.current?.click()

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const list = parseImport(text)
      if (list.length === 0) throw new Error('No conversations in file')
      setConversations(list)
      setActiveId(list[0].id)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Import failed')
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  )

  return (
    <div className="chat-app">
      <aside className="chat-sidebar">
        <div className="chat-sidebar__top">
          <button type="button" className="chat-btn chat-btn--new" onClick={handleNew}>
            <IconPlus />
            新建对话
          </button>
          <button type="button" className="chat-btn chat-btn--icon" title="Layout" aria-label="Sidebar">
            <IconPanel />
          </button>
        </div>

        <div className="chat-sidebar__list">
          {sorted.map((c) => (
            <div key={c.id} style={{ display: 'contents' }}>
              {editingId === c.id ? (
                <form
                  className="chat-thread chat-thread--active"
                  onSubmit={(ev) => {
                    ev.preventDefault()
                    commitRename()
                  }}
                >
                  <span className="chat-thread__icon">
                    <IconChat />
                  </span>
                  <input
                    className="chat-thread__title"
                    style={{
                      background: '#2b2c2f',
                      border: '1px solid #ffffff33',
                      borderRadius: 6,
                      color: 'inherit',
                      padding: '4px 8px',
                    }}
                    value={renameValue}
                    onChange={(ev) => setRenameValue(ev.target.value)}
                    onBlur={commitRename}
                    autoFocus
                  />
                </form>
              ) : (
                <button
                  type="button"
                  className={`chat-thread ${c.id === activeId ? 'chat-thread--active' : ''}`}
                  onClick={() => setActiveId(c.id)}
                >
                  <span className="chat-thread__icon">
                    <IconChat />
                  </span>
                  <span className="chat-thread__title">{c.title}</span>
                  <span className="chat-thread__actions">
                    <button
                      type="button"
                      className="chat-thread__action"
                      title="Rename"
                      aria-label="Rename"
                      onClick={(ev) => startRename(c, ev)}
                    >
                      <IconPencil />
                    </button>
                    <button
                      type="button"
                      className="chat-thread__action"
                      title="Delete"
                      aria-label="Delete"
                      onClick={(ev) => handleDelete(c.id, ev)}
                    >
                      <IconTrash />
                    </button>
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="chat-sidebar__footer">
          <button type="button" className="chat-footer-btn" onClick={handleClearAll}>
            <IconTrash />
            Clear conversations
          </button>
          <button type="button" className="chat-footer-btn" onClick={handleImportPick}>
            <IconImport />
            Import conversations
          </button>
          <button type="button" className="chat-footer-btn" onClick={handleExport}>
            <IconExport />
            Export conversations
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleImportFile}
          />
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-main__header">
          <div className="chat-guardrails-picker">
            <label className="chat-guardrails-picker__label" htmlFor="guardrails-config-id">
              Guardrails:
            </label>
            <select
              id="guardrails-config-id"
              className="chat-guardrails-picker__select"
              value={selectedConfigId}
              onChange={(ev) => setSelectedConfigId(ev.target.value)}
              disabled={isSending}
            >
              {GUARDRAILS_CONFIG_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
        </header>

        {!active ? (
          <div className="chat-empty">Select or create a conversation</div>
        ) : (
          <>
            <div className="chat-scroll">
              {active.messages.length === 0 && !isSending ? (
                <div className="chat-empty">开始对话</div>
              ) : (
                active.messages.map((m, i) => (
                  <div
                    key={m.id}
                    className={`chat-row ${m.role === 'assistant' ? 'chat-row--assistant' : ''}`}
                  >
                    <div className="chat-avatar" aria-hidden>
                      {m.role === 'assistant' ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2a2 2 0 0 1 2 2v1h2a3 3 0 0 1 3 3v2H5V8a3 3 0 0 1 3-3h2V4a2 2 0 0 1 2-2zm-7 9h14v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9z" />
                        </svg>
                      ) : (
                        <IconUser />
                      )}
                    </div>
                    <div
                      className={`chat-bubble ${m.content.startsWith('Error:') ? 'chat-bubble--error' : ''}`}
                    >
                      {m.content || (i === active.messages.length - 1 && isSending ? '…' : '')}
                    </div>
                  </div>
                ))
              )}
              {isSending &&
              active.messages.length > 0 &&
              active.messages[active.messages.length - 1].role === 'user' ? (
                <div className="chat-row chat-row--assistant">
                  <div className="chat-avatar" aria-hidden>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a2 2 0 0 1 2 2v1h2a3 3 0 0 1 3 3v2H5V8a3 3 0 0 1 3-3h2V4a2 2 0 0 1 2-2zm-7 9h14v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9z" />
                    </svg>
                  </div>
                  <div className="chat-bubble">Thinking…</div>
                </div>
              ) : null}
            </div>

            <div className="chat-main__composer">
              <div className="chat-regen">
                <button
                  type="button"
                  className="chat-btn chat-btn--regen"
                  disabled={!canRegenerate}
                  onClick={() => void handleRegenerate()}
                >
                  <IconRefresh />
                  Regenerate response
                </button>
              </div>
              <div className="chat-input-wrap">
                <textarea
                  className="chat-input"
                  rows={1}
                  placeholder="请在此输入问题"
                  value={draft}
                  onChange={(ev) => setDraft(ev.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={isSending}
                />
                <button
                  type="button"
                  className="chat-send"
                  aria-label="Send"
                  disabled={isSending || !draft.trim()}
                  onClick={() => void handleSend()}
                >
                  <IconSend />
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
