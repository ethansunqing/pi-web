import assert from "node:assert/strict";
import test from "node:test";

async function loadSubject() {
  return import("./request-security.ts");
}

test("allows same-origin and non-browser API requests", async () => {
  const { isApiRequestOriginAllowed } = await loadSubject();
  assert.equal(isApiRequestOriginAllowed(new Request("http://localhost:30141/api/test", {
    method: "POST",
    headers: { origin: "http://localhost:30141", "sec-fetch-site": "same-origin" },
  })), true);
  assert.equal(isApiRequestOriginAllowed(new Request("http://localhost:30141/api/test", { method: "POST" })), true);
});

test("allows LAN Host when request.url was normalized to localhost", async () => {
  const { isApiRequestOriginAllowed, getPublicRequestOrigin } = await loadSubject();
  // Simulates Next.js proxy: URL host is localhost, browser Host/Origin are the LAN IP.
  const req = new Request("http://localhost:3000/api/agent/new", {
    method: "POST",
    headers: {
      host: "192.168.100.210:3000",
      origin: "http://192.168.100.210:3000",
      "sec-fetch-site": "same-origin",
    },
  });
  assert.equal(getPublicRequestOrigin(req), "http://192.168.100.210:3000");
  assert.equal(isApiRequestOriginAllowed(req), true);
});

test("allows origin matching x-forwarded-host behind a reverse proxy", async () => {
  const { isApiRequestOriginAllowed } = await loadSubject();
  const req = new Request("http://127.0.0.1:3000/api/sessions", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      "x-forwarded-host": "pi.example.local",
      "x-forwarded-proto": "https",
      origin: "https://pi.example.local",
      "sec-fetch-site": "same-origin",
    },
  });
  assert.equal(isApiRequestOriginAllowed(req), true);
});

test("rejects cross-origin browser API requests", async () => {
  const { isApiRequestOriginAllowed, shouldCheckApiRequestOrigin } = await loadSubject();
  const post = new Request("http://localhost:30141/api/test", {
    method: "POST",
    headers: {
      host: "localhost:30141",
      origin: "https://attacker.example",
      "sec-fetch-site": "cross-site",
    },
  });
  const crossSiteGet = new Request("http://localhost:30141/api/sessions", {
    headers: { host: "localhost:30141", "sec-fetch-site": "cross-site" },
  });
  const mismatchedOrigin = new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://192.168.1.2:3000",
      "sec-fetch-site": "same-site",
    },
  });
  assert.equal(shouldCheckApiRequestOrigin(post), true);
  assert.equal(isApiRequestOriginAllowed(post), false);
  assert.equal(shouldCheckApiRequestOrigin(crossSiteGet), true);
  assert.equal(isApiRequestOriginAllowed(crossSiteGet), false);
  assert.equal(isApiRequestOriginAllowed(mismatchedOrigin), false);
});
