import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.route("**/api/board", (route) =>
    route.fulfill({ status: 200, json: testBoard })
  );
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ status: 401, json: { detail: "Authentication required" } })
  );
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ status: 200, json: { status: "ok" } })
  );
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
}

const testBoard = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1"] },
    { id: "col-discovery", title: "Discovery", cardIds: [] },
    { id: "col-progress", title: "In Progress", cardIds: [] },
    { id: "col-review", title: "Review", cardIds: [] },
    { id: "col-done", title: "Done", cardIds: [] },
  ],
  cards: {
    "card-1": { id: "card-1", title: "Initial title", details: "Initial details" },
  },
};

test("loads the kanban board", async ({ page }) => {
  await signIn(page);
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await signIn(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
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

test("AI chat applies a board update and refreshes the visible card", async ({ page }) => {
  const updatedBoard = {
    ...testBoard,
    cards: {
      ...testBoard.cards,
      "card-1": { ...testBoard.cards["card-1"], title: "Updated by assistant" },
    },
  };
  await page.route("**/api/board", (route) =>
    route.fulfill({ status: 200, json: testBoard })
  );
  await page.route("**/api/ai/chat", (route) =>
    route.fulfill({
      status: 200,
      json: { reply: "Updated the card.", actions_applied: 1, board: updatedBoard },
    })
  );

  await signIn(page);
  await page.getByRole("button", { name: "Open AI assistant" }).click();
  await page.getByLabel("Message the assistant").fill("Rename the first card.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Updated the card.")).toBeVisible();
  await expect(page.getByTestId("card-card-1")).toContainText("Updated by assistant");
});
