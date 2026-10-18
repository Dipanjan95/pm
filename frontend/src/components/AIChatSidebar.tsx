"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { BoardData } from "@/lib/kanban";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AIChatSidebarProps = {
  onBoardChange: (board: BoardData) => void;
};

export const AIChatSidebar = ({ onBoardChange }: AIChatSidebarProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isSending) {
      return;
    }

    setDraft("");
    setError("");
    setMessages((current) => [...current, { role: "user", content: message }]);
    setIsSending(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history: messages.slice(-20) }),
      });
      const result = (await response.json()) as {
        reply?: string;
        board?: BoardData;
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(result.detail || "The assistant could not complete that request.");
      }
      if (typeof result.reply !== "string" || !result.board?.columns || !result.board.cards) {
        throw new Error("The assistant returned an invalid response.");
      }

      const reply = result.reply;
      onBoardChange(result.board);
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to reach the assistant.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside
      id="ai-chat-sidebar"
      className="flex min-h-[520px] flex-col border border-[var(--stroke)] bg-white/95 shadow-[var(--shadow)] xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]"
      aria-label="AI assistant"
    >
      <header className="flex items-center justify-between border-b border-[var(--stroke)] px-5 py-4">
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
        className="flex-1 space-y-3 overflow-y-auto px-4 py-5"
        role="log"
        aria-label="Conversation"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-[var(--gray-text)]">No messages yet.</p>
        ) : null}
        {messages.map((item, index) => (
          <div
            key={`${item.role}-${index}`}
            className={`max-w-[92%] whitespace-pre-wrap break-words px-3 py-2.5 text-sm leading-6 ${
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

      <form className="border-t border-[var(--stroke)] p-4" onSubmit={handleSubmit}>
        {error ? (
          <p className="mb-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <label htmlFor="ai-message" className="sr-only">
          Message the assistant
        </label>
        <textarea
          id="ai-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Ask about your board"
          className="w-full resize-y border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </aside>
  );
};
