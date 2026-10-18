"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";

const persistBoard = async (board: BoardData) => {
  const response = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });

  if (!response.ok) {
    throw new Error(`Board update failed: ${response.status}`);
  }
};

export const KanbanBoard = () => {
  const [board, setBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [boardStatus, setBoardStatus] = useState<"loading" | "ready" | "error">(
    process.env.NODE_ENV === "test" ? "ready" : "loading"
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");

  const saveBoard = async (nextBoard: BoardData) => {
    try {
      await persistBoard(nextBoard);
      setSaveError("");
    } catch {
      setSaveError("Your latest changes could not be saved. Check the connection and try again.");
    }
  };

  useEffect(() => {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    let isMounted = true;

    const loadBoard = async () => {
      try {
        const response = await fetch("/api/board");
        if (!response.ok) {
          throw new Error(`Failed to load board: ${response.status}`);
        }

        const nextBoard = (await response.json()) as BoardData;
        if (isMounted && nextBoard?.columns && nextBoard?.cards) {
          setBoard(nextBoard);
          setBoardStatus("ready");
          setLoadError("");
        } else {
          throw new Error("Invalid board response");
        }
      } catch {
        if (isMounted) {
          setBoardStatus("error");
          setLoadError("Unable to load the board from the server.");
        }
      }
    };

    void loadBoard();

    return () => {
      isMounted = false;
    };
  }, [loadAttempt]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board.cards, [board.cards]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    setBoard((prev) => {
      const nextBoard = {
        ...prev,
        columns: moveCard(prev.columns, active.id as string, over.id as string),
      };
      void saveBoard(nextBoard);
      return nextBoard;
    });
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) => {
      const nextBoard = {
        ...prev,
        columns: prev.columns.map((column) =>
          column.id === columnId ? { ...column, title } : column
        ),
      };
      void saveBoard(nextBoard);
      return nextBoard;
    });
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    setBoard((prev) => {
      const nextBoard = {
        ...prev,
        cards: {
          ...prev.cards,
          [id]: { id, title, details: details || "No details yet." },
        },
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? { ...column, cardIds: [...column.cardIds, id] }
            : column
        ),
      };
      void saveBoard(nextBoard);
      return nextBoard;
    });
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setBoard((prev) => {
      const nextBoard = {
        ...prev,
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => id !== cardId)
        ),
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }
            : column
        ),
      };
      void saveBoard(nextBoard);
      return nextBoard;
    });
  };

  const handleUpdateCard = (cardId: string, title: string, details: string) => {
    setBoard((prev) => {
      const nextBoard = {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: { ...prev.cards[cardId], title, details },
        },
      };
      void saveBoard(nextBoard);
      return nextBoard;
    });
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (boardStatus === "loading") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--gray-text)]" aria-busy="true">
        Loading board...
      </main>
    );
  }

  if (boardStatus === "error") {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-red-700" role="alert">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setBoardStatus("loading");
            setLoadAttempt((attempt) => attempt + 1);
          }}
          className="bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        {saveError ? (
          <p className="text-sm text-red-700" role="alert">{saveError}</p>
        ) : null}
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-3">
              <button
                type="button"
                aria-expanded={isChatOpen}
                aria-controls={isChatOpen ? "ai-chat-sidebar" : undefined}
                onClick={() => setIsChatOpen((isOpen) => !isOpen)}
                className="border border-[var(--navy-dark)] px-4 py-3 text-sm font-semibold text-[var(--navy-dark)] transition hover:bg-[var(--navy-dark)] hover:text-white"
              >
                {isChatOpen ? "Close AI assistant" : "Open AI assistant"}
              </button>
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className={isChatOpen ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" : ""}>
            <section className="grid gap-6 lg:grid-cols-5">
              {board.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId]).filter(Boolean)}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  onUpdateCard={handleUpdateCard}
                />
              ))}
            </section>
            {isChatOpen ? <AIChatSidebar onBoardChange={setBoard} /> : null}
          </div>
          <DragOverlay>
            {activeCard ? (
              <div className="w-[260px]">
                <KanbanCardPreview card={activeCard} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
};
