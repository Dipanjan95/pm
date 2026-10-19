import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "@/app/page";
import type { BoardData } from "@/lib/kanban";
import { stubApi } from "@/test/mockFetch";

const boards = [{ id: "board-1", title: "Main Board" }];

const board: BoardData = {
  columns: [{ id: "col-1", title: "Backlog", cardIds: [] }],
  cards: {},
};

const routes = {
  "GET /api/auth/session": { status: 401, body: { detail: "Authentication required" } },
  "GET /api/boards": boards,
  "GET /api/boards/board-1": board,
};

describe("Home", () => {
  it("shows the board workspace for a signed-in session", async () => {
    stubApi({
      ...routes,
      "GET /api/auth/session": { username: "alice" },
    });

    render(<Home />);

    expect(await screen.findByText("Kanban Studio")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("shows the sign-in form when there is no session", async () => {
    stubApi(routes);
    render(<Home />);

    expect(await screen.findByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();
  });

  it("signs in with valid credentials and shows the workspace", async () => {
    stubApi({
      ...routes,
      "POST /api/auth/login": { username: "alice" },
    });
    render(<Home />);

    await screen.findByRole("heading", { name: /sign in/i });
    await userEvent.type(screen.getByLabelText(/username/i), "alice");
    await userEvent.type(screen.getByLabelText(/password/i), "wonderland9");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Kanban Studio")).toBeInTheDocument();
    });
  });

  it("shows the server detail for rejected credentials", async () => {
    stubApi({
      ...routes,
      "POST /api/auth/login": { status: 401, body: { detail: "Invalid username or password" } },
    });
    render(<Home />);

    await screen.findByRole("heading", { name: /sign in/i });
    await userEvent.type(screen.getByLabelText(/username/i), "alice");
    await userEvent.type(screen.getByLabelText(/password/i), "wrongpass99");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid username or password")).toBeInTheDocument();
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();
  });

  it("registers a new account and lands in the workspace", async () => {
    stubApi({
      ...routes,
      "POST /api/auth/register": { username: "bob" },
    });
    render(<Home />);

    await screen.findByRole("heading", { name: /sign in/i });
    await userEvent.click(screen.getByRole("button", { name: /need an account/i }));

    expect(await screen.findByRole("heading", { name: /create account/i })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/username/i), "bob");
    await userEvent.type(screen.getByLabelText(/password/i), "builder123");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText("Kanban Studio")).toBeInTheDocument();
    });
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("surfaces registration conflicts", async () => {
    stubApi({
      ...routes,
      "POST /api/auth/register": { status: 409, body: { detail: "Username is already taken" } },
    });
    render(<Home />);

    await screen.findByRole("heading", { name: /sign in/i });
    await userEvent.click(screen.getByRole("button", { name: /need an account/i }));
    await userEvent.type(screen.getByLabelText(/username/i), "alice");
    await userEvent.type(screen.getByLabelText(/password/i), "wonderland9");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Username is already taken")).toBeInTheDocument();
  });

  it("logs out and returns to the sign-in form", async () => {
    stubApi({
      ...routes,
      "GET /api/auth/session": { username: "alice" },
      "POST /api/auth/logout": { status: "ok" },
    });
    render(<Home />);

    await screen.findByText("Kanban Studio");
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    });
    expect(screen.queryByText("Kanban Studio")).not.toBeInTheDocument();
  });
});
