import { expect, test, type Page, type Route } from "@playwright/test";

const boardId = "board-1";

const testBoard = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1"] },
    { id: "col-discovery", title: "Discovery", cardIds: [] },
    { id: "col-progress", title: "In Progress", cardIds: [] },
    { id: "col-review", title: "Review", cardIds: [] },
    { id: "col-done", title: "Done", cardIds: [] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Initial title", details: "Initial details", due_date: null },
  },
};

const plainBoard = {
  columns: [{ id: "col-side", title: "Sprint 42", cardIds: [] }],
  cards: {},
};

const newBoard = {
  columns: [{ id: "col-created", title: "Fresh column", cardIds: [] }],
  cards: {},
};

type BoardSummary = { id: string; title: string };

type OverrideValue =
  | { status?: number; json?: unknown }
  | ((route: Route) => Promise<unknown>);

type Override = [pattern: string, value: OverrideValue];

async function signIn(
  page: Page,
  options: {
    boards?: BoardSummary[];
    boardDetails?: Record<string, unknown>;
    overrides?: Override[];
  } = {}
) {
  const boards = options.boards ?? [{ id: boardId, title: "Main Board" }];
  const boardDetails = options.boardDetails ?? { [boardId]: testBoard };

  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ status: 401, json: { detail: "Authentication required" } })
  );
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ status: 200, json: { status: "ok", username: "user" } })
  );
  await page.route("**/api/boards", (route) =>
    route.fulfill({ status: 200, json: boards })
  );
  for (const [id, detail] of Object.entries(boardDetails)) {
    await page.route(`**/api/boards/${id}`, (route) =>
      route.fulfill({ status: 200, json: detail })
    );
    await page.route(`**/api/boards/${id}/messages`, (route) =>
      route.fulfill({ status: 200, json: [] })
    );
  }
  for (const [pattern, value] of options.overrides ?? []) {
    await page.route(pattern, (route) =>
      typeof value === "function"
        ? value(route)
        : route.fulfill({ status: value.status ?? 200, json: value.json })
    );
  }

  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
}

test("loads the kanban board", async ({ page }) => {
  await signIn(page);
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card with a due date to a column", async ({ page }) => {
  await signIn(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByLabel("Due date").fill("2026-11-01");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
  await expect(firstColumn.getByText("Due 2026-11-01")).toBeVisible();
});

test("switches between boards", async ({ page }) => {
  await signIn(page, {
    boards: [
      { id: "board-1", title: "Main Board" },
      { id: "board-2", title: "Side Quests" },
    ],
    boardDetails: { "board-1": testBoard, "board-2": plainBoard },
  });

  await expect(page.getByTestId("column-col-backlog")).toBeVisible();
  await page.getByLabel("Board", { exact: true }).selectOption("board-2");
  await expect(page.getByTestId("column-col-side")).toBeVisible();
  await expect(page.getByLabel("Board title")).toHaveValue("Side Quests");
});

test("creates a board and selects it", async ({ page }) => {
  await signIn(page, {
    overrides: [
      [
        "**/api/boards",
        (route) => {
          if (route.request().method() === "POST") {
            return route.fulfill({
              status: 200,
              json: { id: "board-2", title: "New Board", ...newBoard },
            });
          }
          return route.fulfill({
            status: 200,
            json: [{ id: "board-1", title: "Main Board" }],
          });
        },
      ],
      ["**/api/boards/board-2", { json: newBoard }],
    ],
  });

  await expect(page.getByTestId("column-col-backlog")).toBeVisible();
  await page.getByRole("button", { name: "New board" }).click();

  await expect(page.getByTestId("column-col-created")).toBeVisible();
  await expect(page.getByLabel("Board", { exact: true })).toHaveValue("board-2");
});

test("deletes the active board after confirming", async ({ page }) => {
  await signIn(page, {
    boards: [
      { id: "board-1", title: "Main Board" },
      { id: "board-2", title: "Backup" },
    ],
    boardDetails: { "board-1": testBoard, "board-2": plainBoard },
    overrides: [
      [
        "**/api/boards/board-1",
        (route) => {
          if (route.request().method() === "DELETE") {
            return route.fulfill({ status: 200, json: { status: "ok" } });
          }
          return route.fulfill({ status: 200, json: testBoard });
        },
      ],
    ],
  });
  page.on("dialog", (dialog) => void dialog.accept());

  await expect(page.getByTestId("column-col-backlog")).toBeVisible();
  await page.getByRole("button", { name: "Delete board" }).click();

  await expect(page.getByTestId("column-col-side")).toBeVisible();
  await expect(page.getByLabel("Board title")).toHaveValue("Backup");
});

test("moves a card between columns", async ({ page }) => {
  await signIn(page);
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("AI chat applies a board update and shows the persisted history", async ({ page }) => {
  const updatedBoard = {
    ...testBoard,
    cards: {
      ...testBoard.cards,
      "card-1": { ...testBoard.cards["card-1"], title: "Updated by assistant" },
    },
  };
  await signIn(page, {
    overrides: [
      [
        `**/api/boards/${boardId}/messages`,
        (route) => {
          if (route.request().method() === "GET") {
            return route.fulfill({
              status: 200,
              json: [
                { role: "user", content: "Earlier question" },
                { role: "assistant", content: "Earlier answer" },
              ],
            });
          }
          return route.fulfill({ status: 200, json: { status: "ok" } });
        },
      ],
      ["**/api/ai/chat", { json: { reply: "Updated the card.", actions_applied: 1, board: updatedBoard } }],
    ],
  });

  await page.getByRole("button", { name: "Open AI assistant" }).click();
  await expect(page.getByText("Earlier question")).toBeVisible();
  await expect(page.getByText("Earlier answer")).toBeVisible();

  await page.getByLabel("Message the assistant").fill("Rename the first card.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Updated the card.")).toBeVisible();
  await expect(page.getByTestId("card-card-1")).toContainText("Updated by assistant");
});

test("registers a new account and reaches the workspace", async ({ page }) => {
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ status: 401, json: { detail: "Authentication required" } })
  );
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({ status: 200, json: { status: "ok", username: "newuser" } })
  );
  await page.route("**/api/boards", (route) =>
    route.fulfill({ status: 200, json: [{ id: boardId, title: "Main Board" }] })
  );
  await page.route(`**/api/boards/${boardId}`, (route) =>
    route.fulfill({ status: 200, json: testBoard })
  );
  await page.route(`**/api/boards/${boardId}/messages`, (route) =>
    route.fulfill({ status: 200, json: [] })
  );

  await page.goto("/");
  await page.getByRole("button", { name: /need an account/i }).click();
  await page.getByLabel("Username").fill("newuser");
  await page.getByLabel("Password").fill("newpass123");
  await page.getByRole("button", { name: /create account/i }).click();

  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.getByText("newuser")).toBeVisible();
});
