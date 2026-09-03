"use strict";

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  startServer,
  spawnServerAndWaitForExit,
} = require("../helpers/testServer");

const ADMIN_USER = "testadmin";
const ADMIN_PASSWORD = "S3cret!Pass"; // secret-allow: test fixture, không phải credential thật
const AUTH_HEADER = {
  Authorization: `Basic ${Buffer.from(`${ADMIN_USER}:${ADMIN_PASSWORD}`).toString("base64")}`,
};
const WRONG_AUTH_HEADER = {
  Authorization: `Basic ${Buffer.from("testadmin:wrong-password").toString("base64")}`,
};

// Minimal buffer that satisfies isValidMediaSignature()'s PNG check
// (first 8 bytes = the real PNG magic signature); the rest of the file
// content is irrelevant to that check.
function minimalValidPngBuffer() {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([header, Buffer.from("staynest-test-padding")]);
}

function bufferWithWrongMagicBytes() {
  // Valid length, correct declared extension/mimetype will be used by the
  // caller, but the actual bytes are plain text — not a real PNG signature.
  return Buffer.from("this is definitely not a real png file at all");
}

describe("StayNest server — authorized admin flows", () => {
  let server;

  before(async () => {
    server = await startServer({
      adminUser: ADMIN_USER,
      adminPassword: ADMIN_PASSWORD,
    });
  });

  after(async () => {
    await server.stop();
  });

  test("GET /api/hotel returns 200 without any auth (public endpoint)", async () => {
    // Act
    const res = await fetch(`${server.baseUrl}/api/hotel`);
    const body = await res.json();

    // Assert
    assert.equal(res.status, 200);
    assert.ok(
      body.rooms && Array.isArray(body.rooms),
      "response should contain rooms array",
    );
  });

  test("PUT /api/hotel with valid auth updates fields and preserves rooms", async () => {
    // Arrange
    const before = await (await fetch(`${server.baseUrl}/api/hotel`)).json();
    const newTagline = `updated-tagline-${Date.now()}`;

    // Act
    const res = await fetch(`${server.baseUrl}/api/hotel`, {
      method: "PUT",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ tagline: newTagline }),
    });
    const body = await res.json();

    // Assert
    assert.equal(res.status, 200);
    assert.equal(body.tagline, newTagline);
    assert.equal(
      body.rooms.length,
      before.rooms.length,
      "rooms must be preserved by PUT /api/hotel",
    );
  });

  test("Room CRUD lifecycle with valid auth: create -> update -> delete", async () => {
    // Act 1: create
    const createRes = await fetch(`${server.baseUrl}/api/rooms`, {
      method: "POST",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: { vi: "Phòng test" },
        price: "100.000đ",
        size: "10m2",
      }),
    });
    const created = await createRes.json();

    // Assert 1
    assert.equal(createRes.status, 201);
    assert.ok(created.id, "created room must have an id");

    // Act 2: update
    const updateRes = await fetch(`${server.baseUrl}/api/rooms/${created.id}`, {
      method: "PUT",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ price: "150.000đ" }),
    });
    const updated = await updateRes.json();

    // Assert 2
    assert.equal(updateRes.status, 200);
    assert.equal(updated.id, created.id);
    assert.equal(updated.price, "150.000đ");

    // Act 3: delete
    const deleteRes = await fetch(`${server.baseUrl}/api/rooms/${created.id}`, {
      method: "DELETE",
      headers: AUTH_HEADER,
    });
    const deleteBody = await deleteRes.json();

    // Assert 3
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteBody.success, true);

    const afterDelete = await (
      await fetch(`${server.baseUrl}/api/hotel`)
    ).json();
    assert.ok(
      !afterDelete.rooms.some((r) => r.id === created.id),
      "deleted room must no longer be present",
    );
  });

  test("PUT /api/rooms/:id on unknown id returns 404", async () => {
    const res = await fetch(`${server.baseUrl}/api/rooms/does-not-exist`, {
      method: "PUT",
      headers: { ...AUTH_HEADER, "Content-Type": "application/json" },
      body: JSON.stringify({ price: "1đ" }),
    });
    assert.equal(res.status, 404);
  });

  test("GET /admin with valid auth serves the admin panel HTML from views/", async () => {
    // Act
    const res = await fetch(`${server.baseUrl}/admin`, {
      headers: AUTH_HEADER,
    });
    const body = await res.text();

    // Assert
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") || "", /text\/html/);
    assert.match(body, /<!doctype html>/i);
  });

  test("GET /admin exposes hotel address fields for the map editor", async () => {
    const res = await fetch(`${server.baseUrl}/admin`, {
      headers: AUTH_HEADER,
    });
    const body = await res.text();

    assert.equal(res.status, 200);
    assert.match(body, /name="address_vi"/i);
    assert.match(body, /name="address_zh"/i);
    assert.match(body, /name="address_ko"/i);
  });

  test("POST /api/upload with valid PNG magic bytes succeeds (201) and file is retrievable", async () => {
    // Arrange
    const form = new FormData();
    form.append(
      "image",
      new Blob([minimalValidPngBuffer()], { type: "image/png" }),
      "valid.png",
    );

    // Act
    const res = await fetch(`${server.baseUrl}/api/upload`, {
      method: "POST",
      headers: AUTH_HEADER,
      body: form,
    });
    const body = await res.json();

    // Assert
    assert.equal(res.status, 201);
    assert.match(body.url, /^\/uploads\/.+\.png$/);

    const fileRes = await fetch(`${server.baseUrl}${body.url}`);
    assert.equal(
      fileRes.status,
      200,
      "uploaded file must be servable back via static hosting",
    );
  });

  test("POST /api/upload with correct extension/mimetype but wrong magic bytes is rejected (400) and file is deleted", async () => {
    // Arrange
    const uploadsDir = path.join(server.tempDir, "public", "uploads");
    const before = new Set(fs.readdirSync(uploadsDir));

    const form = new FormData();
    form.append(
      "image",
      new Blob([bufferWithWrongMagicBytes()], { type: "image/png" }),
      "fake.png",
    );

    // Act
    const res = await fetch(`${server.baseUrl}/api/upload`, {
      method: "POST",
      headers: AUTH_HEADER,
      body: form,
    });
    const body = await res.json();

    // Assert
    assert.equal(res.status, 400);
    assert.ok(body.error);

    const after = new Set(fs.readdirSync(uploadsDir));
    assert.deepEqual(
      [...after].sort(),
      [...before].sort(),
      "rejected upload must not leave a file behind in public/uploads",
    );
  });

  test("POST /api/upload with a disallowed extension is rejected (400) via fileFilter whitelist", async () => {
    // Arrange
    const uploadsDir = path.join(server.tempDir, "public", "uploads");
    const before = new Set(fs.readdirSync(uploadsDir));

    const form = new FormData();
    form.append(
      "image",
      new Blob([minimalValidPngBuffer()], { type: "image/png" }),
      "payload.exe",
    );

    // Act
    const res = await fetch(`${server.baseUrl}/api/upload`, {
      method: "POST",
      headers: AUTH_HEADER,
      body: form,
    });
    const body = await res.json();

    // Assert
    assert.equal(res.status, 400);
    assert.ok(body.error);

    const after = new Set(fs.readdirSync(uploadsDir));
    assert.deepEqual(
      [...after].sort(),
      [...before].sort(),
      "extension-filtered upload must not write any file to public/uploads",
    );
  });
});

describe("StayNest server — admin auth enforcement", () => {
  let server;

  before(async () => {
    server = await startServer({
      adminUser: ADMIN_USER,
      adminPassword: ADMIN_PASSWORD,
    });
  });

  after(async () => {
    await server.stop();
  });

  const protectedRoutes = [
    { method: "GET", path: "/admin" },
    { method: "PUT", path: "/api/hotel", jsonBody: {} },
    { method: "POST", path: "/api/rooms", jsonBody: {} },
    { method: "PUT", path: "/api/rooms/whatever", jsonBody: {} },
    { method: "DELETE", path: "/api/rooms/whatever" },
    { method: "POST", path: "/api/upload" },
  ];

  for (const route of protectedRoutes) {
    test(`${route.method} ${route.path} without credentials returns 401`, async () => {
      const res = await fetch(`${server.baseUrl}${route.path}`, {
        method: route.method,
        headers: route.jsonBody
          ? { "Content-Type": "application/json" }
          : undefined,
        body: route.jsonBody ? JSON.stringify(route.jsonBody) : undefined,
      });
      assert.equal(res.status, 401);
    });

    test(`${route.method} ${route.path} with wrong credentials returns 401`, async () => {
      const res = await fetch(`${server.baseUrl}${route.path}`, {
        method: route.method,
        headers: {
          ...WRONG_AUTH_HEADER,
          ...(route.jsonBody ? { "Content-Type": "application/json" } : {}),
        },
        body: route.jsonBody ? JSON.stringify(route.jsonBody) : undefined,
      });
      assert.equal(res.status, 401);
    });
  }

  test("GET /admin.html (legacy static path) is never exposed via express.static — admin.html lives outside public/", async () => {
    // Act
    const res = await fetch(`${server.baseUrl}/admin.html`);
    const body = await res.text();

    // Assert: no route serves /admin.html anymore and admin.html was moved
    // out of public/ into views/ (outside express.static's root), so this
    // must NOT return the admin panel content unauthenticated under any path.
    assert.notEqual(res.status, 200);
    assert.ok(
      !body.includes("StayNest Admin") && !/adminRoomForm|roomForm/i.test(body),
      "admin panel markup must never be servable from a public static path",
    );
  });

  test("GET /admin without credentials returns a genuine basic-auth challenge (WWW-Authenticate header)", async () => {
    const res = await fetch(`${server.baseUrl}/admin`);
    assert.equal(res.status, 401);
    assert.ok(
      res.headers.get("www-authenticate"),
      "401 must carry a WWW-Authenticate challenge header — confirms it came from adminAuth",
    );
  });

  test("GET /api/hotel remains public (no auth required) even while other admin routes are protected", async () => {
    const res = await fetch(`${server.baseUrl}/api/hotel`);
    assert.equal(res.status, 200);
  });
});

describe("StayNest server — missing ADMIN_USER/ADMIN_PASSWORD at startup", () => {
  test("exits with non-zero code when both ADMIN_USER and ADMIN_PASSWORD are missing", async () => {
    // Act
    const { code, stderr } = await spawnServerAndWaitForExit({
      skipEnvVars: ["ADMIN_USER", "ADMIN_PASSWORD"],
    });

    // Assert
    assert.notEqual(code, 0);
    assert.match(stderr, /ADMIN_USER.*ADMIN_PASSWORD/);
  });

  test("exits with non-zero code when only ADMIN_USER is missing", async () => {
    const { code, stderr } = await spawnServerAndWaitForExit({
      skipEnvVars: ["ADMIN_USER"],
    });
    assert.notEqual(code, 0);
    assert.match(stderr, /ADMIN_USER/);
  });

  test("exits with non-zero code when only ADMIN_PASSWORD is missing", async () => {
    const { code, stderr } = await spawnServerAndWaitForExit({
      skipEnvVars: ["ADMIN_PASSWORD"],
    });
    assert.notEqual(code, 0);
    assert.match(stderr, /ADMIN_PASSWORD/);
  });
});
