import { vi } from "vitest";

type RouteHandler = unknown | ((init?: RequestInit) => unknown);

const resolve = (value: unknown, init?: RequestInit) =>
  typeof value === "function" ? (value as (init?: RequestInit) => unknown)(init) : value;

const toResponse = (value: unknown) => {
  if (
    value &&
    typeof value === "object" &&
    "status" in value &&
    "body" in value &&
    typeof (value as { status: unknown }).status === "number"
  ) {
    const envelope = value as { status: number; body: unknown };
    return { ok: envelope.status < 400, status: envelope.status, json: async () => envelope.body };
  }
  return { ok: true, status: 200, json: async () => value };
};

/**
 * Stubs global fetch with a table of exact "METHOD /path" routes.
 * Handler values may be plain response bodies, { status, body } envelopes,
 * or functions receiving the RequestInit for dynamic responses.
 */
export const stubApi = (routes: Record<string, RouteHandler>) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const handler = routes[`${method} ${url}`];
    if (handler === undefined) {
      throw new Error(`Unhandled request in test: ${method} ${url}`);
    }
    return toResponse(resolve(handler, init));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

export const lastBody = (fetchMock: { mock: { calls: unknown[][] } }, method: string) => {
  const calls = fetchMock.mock.calls.filter(
    (call) => ((call[1] as RequestInit | undefined)?.method ?? "GET").toUpperCase() === method
  );
  const init = calls[calls.length - 1]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body ?? "{}"));
};
