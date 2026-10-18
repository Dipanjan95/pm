import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import Home from "@/app/page";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData } from "@/lib/kanban";

afterEach(() => {
  vi.unstubAllGlobals();
});

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders five columns", () => {
    render(<KanbanBoard />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });

  it("edits a card title and details", async () => {
    render(<KanbanBoard />);
    const card = screen.getByTestId("card-card-1");
    await userEvent.click(within(card).getByRole("button", { name: "Edit Align roadmap themes" }));
    await userEvent.clear(within(card).getByLabelText("Card title"));
    await userEvent.type(within(card).getByLabelText("Card title"), "Revised title");
    await userEvent.clear(within(card).getByLabelText("Card details"));
    await userEvent.type(within(card).getByLabelText("Card details"), "Revised details");
    await userEvent.click(within(card).getByRole("button", { name: "Save" }));

    expect(within(card).getByText("Revised title")).toBeInTheDocument();
    expect(within(card).getByText("Revised details")).toBeInTheDocument();
  });

  it("shows the AI reply and refreshes the board from the response", async () => {
    const updatedBoard = {
      ...initialData,
      cards: {
        ...initialData.cards,
        "card-1": { ...initialData.cards["card-1"], title: "Updated by AI" },
      },
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ reply: "Card updated.", board: updatedBoard }),
    }));
    const onBoardChange = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AIChatSidebar onBoardChange={onBoardChange} />);
    await userEvent.type(screen.getByLabelText("Message the assistant"), "Rename card 1");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Card updated.")).toBeInTheDocument();
    expect(onBoardChange).toHaveBeenCalledWith(updatedBoard);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/chat",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("requires a valid login before showing the board", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, options?: RequestInit) => {
      if (options?.method === "POST") {
        const credentials = JSON.parse(String(options.body)) as { password: string };
        const isValid = credentials.password === "password";
        return { ok: isValid, status: isValid ? 200 : 401 };
      }
      return { ok: false, status: 401 };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);

    expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument();
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/username/i));
    await userEvent.clear(screen.getByLabelText(/password/i));
    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByText("Kanban Studio")).toBeInTheDocument();
  });
});
