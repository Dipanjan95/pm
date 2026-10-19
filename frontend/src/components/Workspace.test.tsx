import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Workspace } from "@/components/Workspace";
import type { BoardData } from "@/lib/kanban";
import { lastBody, stubApi } from "@/test/mockFetch";

const boardA: BoardData = {
  columns: [{ id: "col-a", title: "Backlog A", cardIds: [] }],
  cards: {},
};

const boardB: BoardData = {
  columns: [{ id: "col-b", title: "Backlog B", cardIds: [] }],
  cards: {},
};

const twoBoards = [
  { id: "board-1", title: "Main Board" },
  { id: "board-2", title: "Side Quests" },
];

function renderWorkspace(routes: Record<string, unknown>) {
  const fetchMock = stubApi(routes);
  const onLogout = vi.fn();
  render(<Workspace username="alice" onLogout={onLogout} />);
  return { fetchMock, onLogout };
}

const boardRoutes = {
  "GET /api/boards": twoBoards,
  "GET /api/boards/board-1": boardA,
  "GET /api/boards/board-2": boardB,
};

describe("Workspace", () => {
  it("loads the boards and renders the active board", async () => {
    renderWorkspace(boardRoutes);

    expect(await screen.findByTestId("column-col-a")).toBeInTheDocument();
    expect(screen.getByLabelText("Board")).toHaveValue("board-1");
    expect(screen.getByLabelText("Board title")).toHaveValue("Main Board");
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("switches boards from the selector", async () => {
    renderWorkspace(boardRoutes);

    await screen.findByTestId("column-col-a");
    await userEvent.selectOptions(screen.getByLabelText("Board"), "board-2");

    expect(await screen.findByTestId("column-col-b")).toBeInTheDocument();
    expect(screen.getByLabelText("Board title")).toHaveValue("Side Quests");
  });

  it("renames the active board on blur", async () => {
    const { fetchMock } = renderWorkspace({
      ...boardRoutes,
      "PATCH /api/boards/board-1": { status: "ok" },
    });

    await screen.findByTestId("column-col-a");
    const title = screen.getByLabelText("Board title");
    await userEvent.clear(title);
    await userEvent.type(title, "Renamed Board");
    await userEvent.tab();

    await waitFor(() => {
      expect(lastBody(fetchMock, "PATCH")).toEqual({ title: "Renamed Board" });
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Board title")).toHaveValue("Renamed Board");
    });
  });

  it("does not PATCH when the title is unchanged", async () => {
    const { fetchMock } = renderWorkspace(boardRoutes);

    await screen.findByTestId("column-col-a");
    await userEvent.tab();
    await waitFor(() => {
      expect(screen.getByLabelText("Board title")).toHaveValue("Main Board");
    });

    const patchCalls = fetchMock.mock.calls.filter(
      (call) => (call[1] as RequestInit)?.method === "PATCH"
    );
    expect(patchCalls).toHaveLength(0);
  });

  it("shows an error and restores the title when the rename fails", async () => {
    renderWorkspace({
      ...boardRoutes,
      "PATCH /api/boards/board-1": { status: 500, body: null },
    });

    await screen.findByTestId("column-col-a");
    const title = screen.getByLabelText("Board title");
    await userEvent.clear(title);
    await userEvent.type(title, "Renamed Board");
    await userEvent.tab();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The board title could not be saved."
    );
    expect(screen.getByLabelText("Board title")).toHaveValue("Main Board");
  });

  it("creates a board and selects it", async () => {
    const created: BoardData = {
      columns: [{ id: "col-new", title: "Backlog", cardIds: [] }],
      cards: {},
    };
    const { fetchMock } = renderWorkspace({
      ...boardRoutes,
      "POST /api/boards": { id: "board-3", title: "New Board", ...created },
      "GET /api/boards/board-3": created,
    });

    await screen.findByTestId("column-col-a");
    await userEvent.click(screen.getByRole("button", { name: "New board" }));

    await waitFor(() => {
      expect(lastBody(fetchMock, "POST")).toEqual({ title: "New Board" });
    });
    expect(await screen.findByTestId("column-col-new")).toBeInTheDocument();
    expect(screen.getByLabelText("Board")).toHaveValue("board-3");
  });

  it("deletes the active board after confirmation", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { fetchMock } = renderWorkspace({
      ...boardRoutes,
      "DELETE /api/boards/board-1": { status: "ok" },
    });

    await screen.findByTestId("column-col-a");
    await userEvent.click(screen.getByRole("button", { name: "Delete board" }));

    await waitFor(() => {
      const deleteCalls = fetchMock.mock.calls.filter(
        (call) => (call[1] as RequestInit)?.method === "DELETE"
      );
      expect(deleteCalls.length).toBeGreaterThan(0);
    });
    expect(await screen.findByTestId("column-col-b")).toBeInTheDocument();
    expect(screen.getByLabelText("Board title")).toHaveValue("Side Quests");
    confirmSpy.mockRestore();
  });

  it("keeps the board when deletion is not confirmed", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWorkspace(boardRoutes);

    await screen.findByTestId("column-col-a");
    await userEvent.click(screen.getByRole("button", { name: "Delete board" }));

    expect(screen.getByTestId("column-col-a")).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("shows the empty state and creates the first board", async () => {
    const created: BoardData = {
      columns: [{ id: "col-new", title: "Backlog", cardIds: [] }],
      cards: {},
    };
    renderWorkspace({
      "GET /api/boards": [],
      "POST /api/boards": { id: "board-3", title: "New Board", ...created },
      "GET /api/boards/board-3": created,
    });

    expect(await screen.findByText(/no boards yet/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create a board" }));

    expect(await screen.findByTestId("column-col-new")).toBeInTheDocument();
  });

  it("logs out", async () => {
    const { onLogout } = renderWorkspace(boardRoutes);

    await screen.findByTestId("column-col-a");
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(onLogout).toHaveBeenCalled();
  });

  it("offers a retry after the board list fails to load", async () => {
    const fetchMock = stubApi({ "GET /api/boards": { status: 500, body: null } });
    render(<Workspace username="alice" onLogout={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load your boards.");

    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => twoBoards,
    }));
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Board")).toBeInTheDocument();
    });
  });
});

describe("column visibility inside the workspace", () => {
  it("renders cards offered by the active board", async () => {
    const withCards: BoardData = {
      columns: [{ id: "col-a", title: "Backlog A", cardIds: ["card-1"] }],
      cards: { "card-1": { id: "card-1", title: "Visible card", details: "", due_date: null } },
    };
    renderWorkspace({ ...boardRoutes, "GET /api/boards/board-1": withCards });

    expect(await screen.findByText("Visible card")).toBeInTheDocument();
    const column = screen.getByTestId("column-col-a");
    expect(within(column).getByText("Visible card")).toBeInTheDocument();
  });
});
