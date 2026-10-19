"use client";

import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { api } from "@/lib/api";
import type { BoardSummary } from "@/lib/kanban";

type WorkspaceProps = {
  username: string;
  onLogout: () => void;
};

export const Workspace = ({ username, onLogout }: WorkspaceProps) => {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [boardsStatus, setBoardsStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [reloadAttempt, setReloadAttempt] = useState(0);

  const activeBoard = boards.find((board) => board.id === activeId) ?? null;
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");

  // Reset the title draft when the selected board changes. Adjusting state
  // during render (with a guard) avoids an effect, per the React docs.
  if (activeId !== activeBoardId) {
    setActiveBoardId(activeId);
    setTitleDraft(activeBoard?.title ?? "");
  }

  useEffect(() => {
    let isMounted = true;

    api<BoardSummary[]>("/api/boards")
      .then((list) => {
        if (!isMounted) {
          return;
        }
        setBoards(list);
        setActiveId((current) =>
          current && list.some((board) => board.id === current)
            ? current
            : list[0]?.id ?? null
        );
        setBoardsStatus("ready");
      })
      .catch(() => {
        if (isMounted) {
          setBoardsStatus("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [reloadAttempt]);

  const handleCreateBoard = async () => {
    try {
      const board = await api<{ id: string; title: string }>("/api/boards", {
        method: "POST",
        body: JSON.stringify({ title: "New Board" }),
      });
      setBoards((current) => [...current, { id: board.id, title: board.title }]);
      setActiveId(board.id);
      setActionError("");
    } catch (createError) {
      setActionError(
        createError instanceof Error ? createError.message : "Unable to create the board."
      );
    }
  };

  const handleDeleteBoard = async () => {
    if (!activeBoard || !activeId) {
      return;
    }
    if (!window.confirm(`Delete "${activeBoard.title}" and all of its cards?`)) {
      return;
    }

    try {
      await api(`/api/boards/${activeId}`, { method: "DELETE" });
      const remaining = boards.filter((board) => board.id !== activeId);
      setBoards(remaining);
      setActiveId(remaining[0]?.id ?? null);
      setActionError("");
    } catch (deleteError) {
      setActionError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete the board."
      );
    }
  };

  const commitTitle = async () => {
    if (!activeBoard || !activeId) {
      return;
    }
    const next = titleDraft.trim();
    if (!next || next === activeBoard.title) {
      setTitleDraft(activeBoard.title);
      return;
    }

    try {
      await api(`/api/boards/${activeId}`, {
        method: "PATCH",
        body: JSON.stringify({ title: next }),
      });
      setBoards((current) =>
        current.map((board) => (board.id === activeId ? { ...board, title: next } : board))
      );
      setActionError("");
    } catch {
      setTitleDraft(activeBoard.title);
      setActionError("The board title could not be saved.");
    }
  };

  if (boardsStatus === "loading") {
    return (
      <main
        className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--gray-text)]"
        aria-busy="true"
      >
        Loading boards...
      </main>
    );
  }

  if (boardsStatus === "error") {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-red-700" role="alert">
          Unable to load your boards.
        </p>
        <button
          type="button"
          onClick={() => {
            setBoardsStatus("loading");
            setReloadAttempt((attempt) => attempt + 1);
          }}
          className="bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Project management
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Switch between boards, drag cards between stages, and let the
                assistant handle the busywork.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4 text-sm font-semibold text-[var(--navy-dark)]">
                {username}
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-2xl border border-[var(--stroke)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
              >
                Log out
              </button>
              <button
                type="button"
                aria-expanded={isChatOpen}
                aria-controls={isChatOpen ? "ai-chat-sidebar" : undefined}
                onClick={() => setIsChatOpen((isOpen) => !isOpen)}
                className="border border-[var(--navy-dark)] px-4 py-3 text-sm font-semibold text-[var(--navy-dark)] transition hover:bg-[var(--navy-dark)] hover:text-white"
              >
                {isChatOpen ? "Close AI assistant" : "Open AI assistant"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--stroke)] pt-6">
            {boards.length > 0 ? (
              <select
                value={activeId ?? ""}
                onChange={(event) => setActiveId(event.target.value)}
                aria-label="Board"
                className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
              >
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.title}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => void commitTitle()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              placeholder={activeBoard ? undefined : "No board selected"}
              disabled={!activeBoard}
              aria-label="Board title"
              className="min-w-[240px] flex-1 rounded-2xl border border-transparent bg-transparent px-2 py-2 font-display text-lg font-semibold text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)] disabled:opacity-50"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => void handleCreateBoard()}
                className="rounded-2xl bg-[var(--secondary-purple)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                New board
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteBoard()}
                disabled={!activeBoard}
                className="rounded-2xl border border-[var(--stroke)] px-4 py-2.5 text-sm font-semibold text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete board
              </button>
            </div>
          </div>

          {actionError ? (
            <p className="text-sm text-red-700" role="alert">
              {actionError}
            </p>
          ) : null}
        </header>

        {activeId ? (
          <KanbanBoard key={activeId} boardId={activeId} isChatOpen={isChatOpen} />
        ) : (
          <section className="flex flex-col items-center gap-4 rounded-[32px] border border-dashed border-[var(--stroke)] bg-white/60 px-6 py-16 text-center">
            <p className="text-sm text-[var(--gray-text)]">
              No boards yet. Create your first board to start planning.
            </p>
            <button
              type="button"
              onClick={() => void handleCreateBoard()}
              className="bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white"
            >
              Create a board
            </button>
          </section>
        )}
      </main>
    </div>
  );
};
