// JWT_SECRET, ADMIN_PASSWORD_HASH は wrangler.toml の [vars] または Secrets で設定
// EMAIL_SECRET を Secrets に設定すると POST /diary/inbound-email が利用可能

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const respond = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // POST /auth/login
    if (path === "/auth/login" && method === "POST") {
      const { password } = await request.json();
      const valid = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
      if (!valid) return respond({ error: "Unauthorized" }, 401);
      const token = await generateJWT(env.JWT_SECRET);
      return respond({ token });
    }

    // POST /diary/inbound-email （HTTP経由、Email Routing Webhook等）
    if (path === "/diary/inbound-email" && method === "POST") {
      if (!env.EMAIL_SECRET) return respond({ error: "Not configured" }, 503);
      const secret = request.headers.get("X-Email-Secret");
      if (secret !== env.EMAIL_SECRET) return respond({ error: "Forbidden" }, 403);
      const { subject, body, date } = await request.json();
      const id = crypto.randomUUID();
      const entryDate = date || new Date().toISOString().split("T")[0];
      await env.DB.prepare(
        "INSERT INTO entries (id, date, title, content, source) VALUES (?, ?, ?, ?, ?)"
      ).bind(id, entryDate, subject, body, "email").run();
      return respond({ ok: true, id });
    }

    const authHeader = request.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const valid = await verifyJWT(token, env.JWT_SECRET);
    if (!valid) return respond({ error: "Unauthorized" }, 401);

    if (path === "/diary" && method === "GET") {
      const limit = url.searchParams.get("limit") || 50;
      const { results } = await env.DB.prepare(
        "SELECT id, date, title, source, created_at FROM entries ORDER BY date DESC LIMIT ?"
      ).bind(Number(limit)).all();
      return respond({ entries: results });
    }

    if (path.startsWith("/diary/") && method === "GET") {
      const date = path.split("/diary/")[1];
      const { results } = await env.DB.prepare(
        "SELECT * FROM entries WHERE date = ? ORDER BY created_at DESC"
      ).bind(date).all();
      const { results: images } = await env.DB.prepare(
        "SELECT * FROM images WHERE entry_date = ?"
      ).bind(date).all();
      return respond({ entries: results, images });
    }

    if (path === "/diary" && method === "POST") {
      const { date, title, content, source } = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO entries (id, date, title, content, source) VALUES (?, ?, ?, ?, ?)"
      ).bind(id, date, title || null, content, source || "manual").run();
      return respond({ ok: true, id });
    }

    if (path.startsWith("/diary/") && method === "PUT") {
      const id = path.split("/diary/")[1];
      const { title, content } = await request.json();
      await env.DB.prepare(
        "UPDATE entries SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(title || null, content, id).run();
      return respond({ ok: true });
    }

    if (path.startsWith("/diary/") && method === "DELETE") {
      const id = path.split("/diary/")[1];
      await env.DB.prepare("DELETE FROM entries WHERE id = ?").bind(id).run();
      return respond({ ok: true });
    }

    if (path === "/diary/upload-image" && method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file");
      const entryDate = formData.get("date") || new Date().toISOString().split("T")[0];
      if (!file) return respond({ error: "No file" }, 400);

      const imageId = crypto.randomUUID();
      const ext = file.name.split(".").pop();
      const r2Key = `${entryDate}/${imageId}.${ext}`;

      await env.R2.put(r2Key, file.stream(), {
        httpMetadata: { contentType: file.type },
      });

      await env.DB.prepare(
        "INSERT INTO images (id, entry_date, r2_key, filename) VALUES (?, ?, ?, ?)"
      ).bind(imageId, entryDate, r2Key, file.name).run();

      return respond({ ok: true, id: imageId, r2_key: r2Key });
    }

    if (path.startsWith("/images/") && method === "GET") {
      const key = path.replace("/images/", "");
      const obj = await env.R2.get(key);
      if (!obj) return new Response("Not found", { status: 404 });
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
          ...corsHeaders,
        },
      });
    }

    return respond({ error: "Not found" }, 404);
  },

  async email(message, env) {
    const body = await new Response(message.raw).text();
    const date = new Date().toISOString().split("T")[0];
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO entries (id, date, title, content, source) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, date, message.headers.get("subject"), body, "email").run();
  },
};

async function generateJWT(secret) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ exp: Date.now() + 86400000 * 30 }));
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}

async function verifyJWT(token, secret) {
  try {
    const [header, payload, sig] = token.split(".");
    const data = `${header}.${payload}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(data));
    if (!valid) return false;
    const { exp } = JSON.parse(atob(payload));
    return Date.now() < exp;
  } catch {
    return false;
  }
}

async function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== "string") return false;
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex.toLowerCase() === storedHash.trim().toLowerCase();
}
