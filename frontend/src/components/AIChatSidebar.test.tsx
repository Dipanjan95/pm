import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import type { BoardData } from "@/lib/kanban";
import { lastBody, stubApi } from "@/test/mockFetch";

const boardId = "board-1";

const currentBoard: BoardData = {
  columns: [{ id: "col-1", title: "Backlog", cardIds: ["card-1"] }],
  cards: { "card-1": { id: "card-1", title: "Existing card", details: "", due_date: null } },
};

const updatedBoard: BoardData = {
  ...currentBoard,
  cards: {
    ...currentBoard.cards,
    "card-1": { ...currentBoard.cards["card-1"], title: "Updated by assistant" },
  },
};

const renderSidebar = (routes: Record<string, unknown>) => {
  const fetchMock = stubApi(routes);
  const onBoardChange = vi.fn();
  render(<AIChatSidebar boardId={boardId} onBoardChange={onBoardChange} />);
  return { onBoardChange, fetchMock };
};

describe("AIChatSidebar", () => {
  it("renders the persisted conversation", async () => {
    renderSidebar({
      [`GET /api/boards/${boardId}/messages`]: [
        { role: "user", content: "Earlier question" },
        { role: "assistant", content: "Earlier answer" },
      ],
    });

    expect(await screen.findByText("Earlier question")).toBeInTheDocument();
    expect(screen.getByText("Earlier answer")).toBeInTheDocument();
    expect(screen.queryByText("No messages yet.")).not.toBeInTheDocument();
  });

  it("sends a message and applies the returned board", async () => {
    const { onBoardChange } = renderSidebar({
      [`GET /api/boards/${boardId}/messages`]: [],
      "POST /api/ai/chat": (init?: RequestInit) => {
        expect(JSON.parse(String(init?.body))).toEqual({
          board_id: boardId,
          message: "Rename the card",
        });
        return { reply: "Card updated.", board: updatedBoard };
      },
    });

    await screen.findByText("No messages yet.");
    await userEvent.type(screen.getByLabelText("Message the assistant"), "Rename the card");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Rename the card")).toBeInTheDocument();
    expect(await screen.findByText("Card updated.")).toBeInTheDocument();
    expect(onBoardChange).toHaveBeenCalledWith(updatedBoard);
  });

  it("shows the server detail when the assistant fails", async () => {
    renderSidebar({
      [`GET /api/boards/${boardId}/messages`]: [],
      "POST /api/ai/chat": { status: 502, body: { detail: "AI provider request failed" } },
    });

    await screen.findByText("No messages yet.");
    await userEvent.type(screen.getByLabelText("Message the assistant"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("AI provider request failed");
  });

  it("degrades gracefully when the history fails to load", async () => {
    renderSidebar({
      [`GET /api/boards/${boardId}/messages`]: { status: 500, body: null },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load the conversation history."
    );
    expect(screen.getByText("No messages yet.")).toBeInTheDocument();
  });

  it("still sends a message after a failed history load", async () => {
    const { fetchMock } = renderSidebar({
      [`GET /api/boards/${boardId}/messages`]: { status: 500, body: null },
      "POST /api/ai/chat": { reply: "Recovered.", board: currentBoard },
    });

    await screen.findByText("No messages yet.");
    await userEvent.type(screen.getByLabelText("Message the assistant"), "Try again");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Recovered.")).toBeInTheDocument();
    await waitFor(() => {
      expect(lastBody(fetchMock, "POST")).toEqual({
        board_id: boardId,
        message: "Try again",
      });
    });
  });
});
