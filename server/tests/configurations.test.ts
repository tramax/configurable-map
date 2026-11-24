import { describe, expect, it } from "vitest";
import { configurations } from "@shared/db/schema";
import { DATASET, VALID_CONFIG, createTestApp } from "./helpers";

type Saved = {
  id: string;
  name: string;
  visibility: string;
  mine: boolean;
  author: string | null;
};

const list = async (client: { get: (p: string) => Promise<Response> }) =>
  (await (await client.get(`/api/configurations?datasetId=${DATASET}`)).json()) as Saved[];

const save = async (client: { post: (p: string, b?: unknown) => Promise<Response> }, name: string) => {
  const res = await client.post("/api/configurations", { datasetId: DATASET, name, config: VALID_CONFIG });
  expect(res.status).toBe(201);
  return (await res.json()) as Saved;
};

describe("default configuration", () => {
  it("is served without signing in", async () => {
    const { app } = createTestApp();
    const res = await app.request(`/api/configurations/default?datasetId=${DATASET}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; isDefault: boolean; author: string | null };
    expect(body).toMatchObject({ name: "Default", isDefault: true, author: null });
  });

  it("is 404 when the dataset has none", async () => {
    const { app } = createTestApp({ withDefault: false });
    const res = await app.request(`/api/configurations/default?datasetId=${DATASET}`);
    expect(res.status).toBe(404);
  });

  it("is 500 when the stored default is not a valid configuration", async () => {
    const { app, db } = createTestApp();
    db.update(configurations).set({ config: { symbolConfig: {} } as never }).run();
    const res = await app.request(`/api/configurations/default?datasetId=${DATASET}`);
    expect(res.status).toBe(500);
  });
});

describe("authentication", () => {
  it("requires a session for everything except the default", async () => {
    const { app } = createTestApp();
    expect((await app.request(`/api/configurations?datasetId=${DATASET}`)).status).toBe(401);
    const post = await app.request("/api/configurations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ datasetId: DATASET, name: "x", config: VALID_CONFIG }),
    });
    expect(post.status).toBe(401);
    expect((await app.request("/api/configurations/some-id/publish", { method: "POST" })).status).toBe(401);
  });

  it("rejects a wrong password", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "nope" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects a login body that is not JSON with 415", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/auth/login", { method: "POST", body: "username=alice" });
    expect(res.status).toBe(415);
  });
});

describe("saving a configuration", () => {
  it("saves a private configuration the owner can list again", async () => {
    const { login } = createTestApp();
    const alice = await login("alice");
    const saved = await save(alice, "Tall trees");
    expect(saved).toMatchObject({
      name: "Tall trees",
      visibility: "private",
      mine: true,
      author: "alice",
    });

    const mine = (await list(alice)).find((configuration) => configuration.id === saved.id);
    expect(mine?.name).toBe("Tall trees");
  });

  it("rejects an invalid configuration with 400 and names the problem", async () => {
    const { login } = createTestApp();
    const alice = await login("alice");
    const res = await alice.post("/api/configurations", {
      datasetId: DATASET,
      name: "Bad",
      config: { ...VALID_CONFIG, tableConfig: { columns: ["A", "A"] } },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/unique/i);
  });

  it("rejects a blank name", async () => {
    const { login } = createTestApp();
    const alice = await login("alice");
    const res = await alice.post("/api/configurations", { datasetId: DATASET, name: "   ", config: VALID_CONFIG });
    expect(res.status).toBe(400);
  });
});

describe("sharing", () => {
  it("keeps a private configuration invisible to other users", async () => {
    const { login } = createTestApp();
    const alice = await login("alice");
    const bob = await login("bob");
    const saved = await save(alice, "Secret");

    expect((await list(bob)).some((configuration) => configuration.id === saved.id)).toBe(false);
  });

  it("shows a published configuration to others, with its author, until it is unpublished", async () => {
    const { login } = createTestApp();
    const alice = await login("alice");
    const bob = await login("bob");
    const saved = await save(alice, "Shared one");

    const published = await alice.post(`/api/configurations/${saved.id}/publish`);
    expect(published.status).toBe(200);
    expect(((await published.json()) as Saved).visibility).toBe("public");

    const seenByBob = (await list(bob)).find((configuration) => configuration.id === saved.id);
    expect(seenByBob).toMatchObject({ author: "alice", mine: false, visibility: "public" });

    const unpublished = await alice.post(`/api/configurations/${saved.id}/unpublish`);
    expect(unpublished.status).toBe(200);
    expect(((await unpublished.json()) as Saved).visibility).toBe("private");
    expect((await list(bob)).some((configuration) => configuration.id === saved.id)).toBe(false);
    expect((await list(alice)).some((configuration) => configuration.id === saved.id)).toBe(true);
  });

  it("answers 404 when publishing or unpublishing someone else's configuration, and changes nothing", async () => {
    const { login } = createTestApp();
    const alice = await login("alice");
    const bob = await login("bob");
    const saved = await save(alice, "Alice's");

    expect((await bob.post(`/api/configurations/${saved.id}/publish`)).status).toBe(404);
    expect((await bob.post(`/api/configurations/${saved.id}/unpublish`)).status).toBe(404);
    expect((await list(alice)).find((configuration) => configuration.id === saved.id)?.visibility).toBe("private");
  });

  it("answers 404 for an id that does not exist, and for the system default", async () => {
    const { login } = createTestApp();
    const alice = await login("alice");
    expect((await alice.post("/api/configurations/missing/publish")).status).toBe(404);
    expect((await alice.post("/api/configurations/default/publish")).status).toBe(404);
  });

  it("lists the system default for every signed-in user", async () => {
    const { login } = createTestApp();
    const bob = await login("bob");
    const defaults = (await list(bob)).filter((configuration) => configuration.visibility === "system");
    expect(defaults).toHaveLength(1);
  });
});
