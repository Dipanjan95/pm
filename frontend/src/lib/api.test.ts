import { api } from "@/lib/api";
import { stubApi } from "@/test/mockFetch";

describe("api", () => {
  it("returns parsed JSON on success", async () => {
    stubApi({ "GET /api/boards": [{ id: "b1", title: "Main" }] });
    await expect(api("/api/boards")).resolves.toEqual([{ id: "b1", title: "Main" }]);
  });

  it("throws an ApiError carrying the server detail", async () => {
    stubApi({
      "POST /api/auth/login": { status: 401, body: { detail: "Invalid username or password" } },
    });
    await expect(
      api("/api/auth/login", { method: "POST", body: JSON.stringify({}) })
    ).rejects.toThrow("Invalid username or password");
  });

  it("falls back to a generic message when no detail exists", async () => {
    stubApi({ "GET /api/broken": { status: 500, body: null } });
    await expect(api("/api/broken")).rejects.toThrow("Request failed with status 500.");
  });
});
