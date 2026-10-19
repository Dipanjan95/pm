"use client";

import { useEffect, useState } from "react";
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
import { api } from "@/lib/api";
import { createId, moveCard, type BoardData } from "@/lib/kanban";

type KanbanBoardProps = {
  boardId: string;
  isChatOpen: boolean;
};

export const KanbanBoard = ({ boardId, isChatOpen }: KanbanBoardProps) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadBoard = async () => {
      try {
        const nextBoard = await api<BoardData>(`/api/boards/${boardId}`);
        if (!isMounted) {
          return;
        }
        if (!nextBoard?.columns || !nextBoard?.cards) {
          throw new Error("Invalid board response");
        }
        setBoard(nextBoard);
        setStatus("ready");
        setLoadError("");
      } catch {
        if (!isMounted) {
          return;
        }
        setStatus("error");
        setLoadError("Unable to load the board from the server.");
      }
    };

    void loadBoard();

    return () => {
      isMounted = false;
    };
  }, [boardId, loadAttempt]);

  const saveBoard = async (nextBoard: BoardData) => {
    try {
      await api(`/api/boards/${boardId}`, {
        method: "PUT",
        body: JSON.stringify(nextBoard),
      });
      setSaveError("");
    } catch {
      setSaveError(
        "Your latest changes could not be saved. Check the connection and try again."
      );
    }
  };

  const applyBoardChange = (transform: (prev: BoardData) => BoardData) => {
    if (!board) {
      return;
    }
    const nextBoard = transform(board);
    setBoard(nextBoard);
    void saveBoard(nextBoard);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    applyBoardChange((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, active.id as string, over.id as string),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    applyBoardChange((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }));
  };

  const handleAddCard = (
    columnId: string,
    title: string,
    details: string,
    dueDate: string | null
  ) => {
    const id = createId("card");
    applyBoardChange((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [id]: { id, title, details: details || "No details yet.", due_date: dueDate },
      },
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    applyBoardChange((prev) => ({
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
    }));
  };

  const handleUpdateCard = (
    cardId: string,
    title: string,
    details: string,
    dueDate: string | null
  ) => {
    applyBoardChange((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [cardId]: { ...prev.cards[cardId], title, details, due_date: dueDate },
      },
    }));
  };

  const activeCard = activeCardId ? board?.cards[activeCardId] ?? null : null;

  if (status === "loading") {
    return (
      <main
        className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--gray-text)]"
        aria-busy="true"
      >
        Loading board...
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-red-700" role="alert">
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("loading");
            setLoadAttempt((attempt) => attempt + 1);
          }}
          className="bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </main>
    );
  }

  if (!board) {
    return null;
  }

  return (
    <>
      {saveError ? (
        <p className="text-sm text-red-700" role="alert">
          {saveError}
        </p>
      ) : null}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
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
        <DragOverlay>
          {activeCard ? (
            <div className="w-[260px]">
              <KanbanCardPreview card={activeCard} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {isChatOpen ? <AIChatSidebar boardId={boardId} onBoardChange={setBoard} /> : null}
    </>
  );
};
