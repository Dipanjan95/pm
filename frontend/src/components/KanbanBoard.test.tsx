import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import type { BoardData } from "@/lib/kanban";
import { lastBody, stubApi } from "@/test/mockFetch";

const boardId = "board-1";

const testBoard: BoardData = {
  columns: [
    { id: "col-1", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-2", title: "Done", cardIds: [] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "First card", details: "Details", due_date: null },
    "card-2": { id: "card-2", title: "Second card", details: "", due_date: "2020-01-01" },
  },
};

const renderBoard = (board: BoardData = testBoard) => {
  const fetchMock = stubApi({ [`GET /api/boards/${boardId}`]: board });
  render(<KanbanBoard boardId={boardId} isChatOpen={false} />);
  return fetchMock;
};

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders the board columns and cards", async () => {
    renderBoard();

    expect(await screen.findByTestId("column-col-1")).toBeInTheDocument();
    expect(screen.getByTestId("column-col-2")).toBeInTheDocument();
    expect(screen.getByText("First card")).toBeInTheDocument();
    expect(screen.getByText("Due 2020-01-01")).toBeInTheDocument();
  });

  it("commits a column rename on blur and saves the board", async () => {
    const fetchMock = renderBoard();
    await screen.findByTestId("column-col-1");
    const input = within(getFirstColumn()).getByLabelText("Column title");

    await userEvent.clear(input);
    await userEvent.type(input, "Renamed");
    await userEvent.tab();

    await waitFor(() => {
      const body = lastBody(fetchMock, "PUT");
      expect(body.columns[0].title).toBe("Renamed");
    });
  });

  it("adds a card with a due date and saves the board", async () => {
    const fetchMock = renderBoard();
    await screen.findByTestId("column-col-1");
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Fresh card");
    await userEvent.type(within(column).getByLabelText("Due date"), "2026-11-01");
    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    await waitFor(() => {
      const body = lastBody(fetchMock, "PUT");
      const cards = Object.values(body.cards) as { id: string; title: string; due_date: string | null }[];
      const added = cards.find((card) => card.title === "Fresh card");
      expect(added?.due_date).toBe("2026-11-01");
      expect(body.columns[0].cardIds).toContain(added?.id);
    });
    expect(await screen.findByText("Fresh card")).toBeInTheDocument();
  });

  it("edits a card title, details, and due date", async () => {
    const fetchMock = renderBoard();
    const card = await screen.findByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: "Edit First card" }));
    await userEvent.clear(within(card).getByLabelText("Card title"));
    await userEvent.type(within(card).getByLabelText("Card title"), "Revised title");
    await userEvent.type(within(card).getByLabelText("Card due date"), "2026-12-24");
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const body = lastBody(fetchMock, "PUT");
      expect(body.cards["card-1"].title).toBe("Revised title");
      expect(body.cards["card-1"].due_date).toBe("2026-12-24");
    });
    expect(await screen.findByText("Revised title")).toBeInTheDocument();
    expect(screen.getByText("Due 2026-12-24")).toBeInTheDocument();
  });

  it("removes a card and saves the board", async () => {
    const fetchMock = renderBoard();
    await screen.findByText("First card");
    await userEvent.click(screen.getByRole("button", { name: /delete first card/i }));

    await waitFor(() => {
      const body = lastBody(fetchMock, "PUT");
      expect(body.cards["card-1"]).toBeUndefined();
      expect(body.columns[0].cardIds).toEqual(["card-2"]);
    });
    expect(screen.queryByText("First card")).not.toBeInTheDocument();
  });

  it("flags overdue cards", async () => {
    renderBoard();
    const badge = await screen.findByText("Due 2020-01-01");
    expect(badge.className).toContain("text-red-600");
  });

  it("ignores an unchanged column rename on blur", async () => {
    const fetchMock = renderBoard();
    await screen.findByTestId("column-col-1");
    const input = within(getFirstColumn()).getByLabelText("Column title");

    await userEvent.clear(input);
    await userEvent.type(input, "  ");
    await userEvent.tab();

    const putCalls = fetchMock.mock.calls.filter(
      (call) => (call[1] as RequestInit)?.method === "PUT"
    );
    expect(putCalls).toHaveLength(0);
    expect(input).toHaveValue("Backlog");
  });

  it("cancels the add-card form", async () => {
    renderBoard();
    await screen.findByTestId("column-col-1");
    const column = getFirstColumn();
    await userEvent.click(within(column).getByRole("button", { name: /add a card/i }));
    await userEvent.type(within(column).getByPlaceholderText(/card title/i), "Abandoned");
    await userEvent.click(within(column).getByRole("button", { name: "Cancel" }));

    expect(within(column).queryByPlaceholderText(/card title/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Abandoned")).not.toBeInTheDocument();
  });

  it("shows the load error state and recovers on retry", async () => {
    const fetchMock = stubApi({
      [`GET /api/boards/${boardId}`]: { status: 500, body: null },
    });
    render(<KanbanBoard boardId={boardId} isChatOpen={false} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load the board from the server."
    );

    // Retry path: point the stubbed fetch at a successful response.
    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => testBoard,
    }));

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("First card")).toBeInTheDocument();
  });

  it("shows a banner when saving fails", async () => {
    stubApi({
      [`GET /api/boards/${boardId}`]: testBoard,
      [`PUT /api/boards/${boardId}`]: { status: 500, body: null },
    });
    render(<KanbanBoard boardId={boardId} isChatOpen={false} />);

    await screen.findByText("First card");
    await userEvent.click(screen.getByRole("button", { name: /delete first card/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your latest changes could not be saved."
    );
  });
});
