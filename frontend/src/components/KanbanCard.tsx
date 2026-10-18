import { useState, type FormEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onUpdate: (cardId: string, title: string, details: string) => void;
};

export const KanbanCard = ({ card, onDelete, onUpdate }: KanbanCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }
    onUpdate(card.id, nextTitle, details);
    setIsEditing(false);
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      data-testid={`card-${card.id}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        {isEditing ? (
          <form className="space-y-3" onSubmit={handleSave} onPointerDown={(event) => event.stopPropagation()}>
            <label className="block text-xs font-semibold text-[var(--gray-text)]">
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                required
                className="mt-1 w-full border border-[var(--stroke)] bg-white px-2 py-1 text-sm text-[var(--navy-dark)]"
                aria-label="Card title"
              />
            </label>
            <label className="block text-xs font-semibold text-[var(--gray-text)]">
              Details
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                maxLength={2000}
                rows={3}
                className="mt-1 w-full border border-[var(--stroke)] bg-white px-2 py-1 text-sm text-[var(--navy-dark)]"
                aria-label="Card details"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsEditing(false)} className="px-2 py-1 text-xs font-semibold text-[var(--gray-text)]">
                Cancel
              </button>
              <button type="submit" className="bg-[var(--secondary-purple)] px-3 py-1 text-xs font-semibold text-white">
                Save
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
                {card.title}
              </h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--gray-text)]">
                {card.details}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setIsEditing(true)}
                className="border border-transparent px-2 py-1 text-xs font-semibold text-[var(--primary-blue)] transition hover:border-[var(--stroke)]"
                aria-label={`Edit ${card.title}`}
              >
                Edit
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onDelete(card.id)}
                className="border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
                aria-label={`Delete ${card.title}`}
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
};
