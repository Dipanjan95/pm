import { createId, isOverdue, moveCard, type Column } from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });

  it("drops a card to the end of its own column when dropped on the column", () => {
    const result = moveCard(baseColumns, "card-1", "col-a");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("inserts a card at the target position when dropped on another card", () => {
    const columns: Column[] = [
      { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
      { id: "col-b", title: "B", cardIds: ["card-3", "card-4"] },
    ];
    const result = moveCard(columns, "card-1", "card-4");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1", "card-4"]);
  });

  it("keeps columns unchanged when a card is missing from its column", () => {
    const columns: Column[] = [
      { id: "col-a", title: "A", cardIds: [] },
    ];
    expect(moveCard(columns, "card-1", "col-a")).toEqual(columns);
  });

  it("ignores unknown card ids", () => {
    expect(moveCard(baseColumns, "card-unknown", "card-1")).toEqual(baseColumns);
  });
});

describe("createId", () => {
  it("creates unique prefixed ids", () => {
    const first = createId("card");
    const second = createId("card");
    expect(first).toMatch(/^card-/);
    expect(first).not.toBe(second);
  });
});

describe("isOverdue", () => {
  const today = new Date("2026-10-19T12:00:00");

  it("flags dates before today", () => {
    expect(isOverdue("2026-10-18", today)).toBe(true);
  });

  it("does not flag today or later", () => {
    expect(isOverdue("2026-10-19", today)).toBe(false);
    expect(isOverdue("2026-10-20", today)).toBe(false);
  });

  it("ignores missing dates", () => {
    expect(isOverdue(null, today)).toBe(false);
  });
});
