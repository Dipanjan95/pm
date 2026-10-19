"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AIChatSidebarProps = {
  boardId: string;
  onBoardChange: (board: BoardData) => void;
};

export const AIChatSidebar = ({ boardId, onBoardChange }: AIChatSidebarProps) => {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const conversationRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    panelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, []);

  useEffect(() => {
    let isMounted = true;

    api<ChatMessage[]>(`/api/boards/${boardId}/messages`)
      .then((history) => {
        if (isMounted) {
          setMessages(history);
        }
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setMessages([]);
        setError("Unable to load the conversation history.");
      });

    return () => {
      isMounted = false;
    };
  }, [boardId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isSending || messages === null) {
      return;
    }

    setDraft("");
    setError("");
    setMessages((current) => [...(current ?? []), { role: "user", content: message }]);
    setIsSending(true);

    try {
      const result = await api<{ reply: string; board: BoardData }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({ board_id: boardId, message }),
      });

      if (typeof result.reply !== "string" || !result.board?.columns || !result.board.cards) {
        throw new Error("The assistant returned an invalid response.");
      }

      onBoardChange(result.board);
      setMessages((current) => [...(current ?? []), { role: "assistant", content: result.reply }]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to reach the assistant.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside
      ref={panelRef}
      id="ai-chat-sidebar"
      className="flex flex-col rounded-[32px] border border-[var(--stroke)] bg-white/80 shadow-[var(--shadow)] backdrop-blur"
      aria-label="AI assistant"
    >
      <header className="flex items-center justify-between border-b border-[var(--stroke)] px-8 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            Board assistant
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-[var(--navy-dark)]">
            AI chat
          </h2>
        </div>
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-yellow)]" aria-hidden="true" />
      </header>

      <div
        ref={conversationRef}
        className="max-h-[340px] min-h-[160px] space-y-3 overflow-y-auto px-8 py-5"
        role="log"
        aria-label="Conversation"
        aria-live="polite"
      >
        {messages === null ? (
          <p className="text-sm text-[var(--gray-text)]" aria-busy="true">
            Loading conversation...
          </p>
        ) : null}
        {messages?.length === 0 ? (
          <p className="text-sm text-[var(--gray-text)]">No messages yet.</p>
        ) : null}
        {messages?.map((item, index) => (
          <div
            key={`${item.role}-${index}`}
            className={`max-w-2xl whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-6 ${
              item.role === "user"
                ? "ml-auto bg-[var(--navy-dark)] text-white"
                : "border border-[var(--stroke)] bg-[var(--surface)] text-[var(--navy-dark)]"
            }`}
          >
            {item.content}
          </div>
        ))}
        {isSending ? (
          <p className="text-sm text-[var(--gray-text)]" aria-label="Assistant is responding">
            Thinking...
          </p>
        ) : null}
      </div>

      <form className="border-t border-[var(--stroke)] px-8 py-5" onSubmit={handleSubmit}>
        {error ? (
          <p className="mb-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex items-end gap-3">
          <label htmlFor="ai-message" className="sr-only">
            Message the assistant
          </label>
          <textarea
            id="ai-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Ask about your board"
            className="flex-1 resize-none rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="shrink-0 rounded-2xl bg-[var(--secondary-purple)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </aside>
  );
};
