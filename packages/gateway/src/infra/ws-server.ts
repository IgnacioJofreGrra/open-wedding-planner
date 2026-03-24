import { createHash, randomBytes } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import type {
  ClientMessage,
  ServerMessage,
  GatewayStateSnapshot,
} from "@wedding-planner/shared";
import type { Router, Db } from "./router.js";
import { getWebDistDir } from "../config/paths.js";

interface AuthenticatedClient {
  ws: WebSocket;
  authenticated: boolean;
  pendingToken: string | null;
}

export interface WsServerOptions {
  port: number;
  getState: () => GatewayStateSnapshot;
  router?: Router;
  db?: Db;
  imagesDir?: string;
  onVapiWebhook?: (payload: unknown) => void;
  onGoogleOAuthCallback?: (
    callbackUrl: string,
  ) => Promise<{ ok: boolean; message: string }>;
}

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const WEB_MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ...MIME_TYPES,
};

function serveStaticFile(filePath: string, res: ServerResponse, cache = false) {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = WEB_MIME_TYPES[ext] ?? "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    ...(cache
      ? { "Cache-Control": "public, max-age=31536000, immutable" }
      : {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          Vary: "Authorization, Cookie",
        }),
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function getBasicAuthConfig() {
  const username = process.env.WP_BASIC_AUTH_USER?.trim();
  const password = process.env.WP_BASIC_AUTH_PASSWORD?.trim();
  const enabled = Boolean(username && password);
  const cookieName = "wp_auth";
  const cookieValue = enabled
    ? createHash("sha256")
        .update(`${username}:${password}`)
        .digest("hex")
    : "";
  return { enabled, username, password, cookieName, cookieValue };
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  const parts = header.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function isAuthorized(
  req: IncomingMessage,
  authConfig: ReturnType<typeof getBasicAuthConfig>,
): boolean {
  if (!authConfig.enabled) return true;

  const header = req.headers.authorization;
  if (header?.startsWith("Basic ")) {
    const encoded = header.slice(6).trim();
    let decoded: string;
    try {
      decoded = Buffer.from(encoded, "base64").toString("utf8");
    } catch {
      decoded = "";
    }

    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex !== -1) {
      const username = decoded.slice(0, separatorIndex);
      const password = decoded.slice(separatorIndex + 1);

      if (username === authConfig.username && password === authConfig.password) {
        return true;
      }
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  return cookies[authConfig.cookieName] === authConfig.cookieValue;
}

function setAuthCookie(
  req: IncomingMessage,
  res: ServerResponse,
  authConfig: ReturnType<typeof getBasicAuthConfig>,
) {
  if (!authConfig.enabled) return;
  const forwardedProto = (req.headers["x-forwarded-proto"] ?? "")
    .toString()
    .toLowerCase();
  const isSecure = forwardedProto === "https" || Boolean((req.socket as any).encrypted);
  const cookie = [
    `${authConfig.cookieName}=${authConfig.cookieValue}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=86400",
    ...(isSecure ? ["Secure"] : []),
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);
}

function writeUnauthorized(res: ServerResponse) {
  res.writeHead(401, {
    "WWW-Authenticate": 'Basic realm="Open Wedding Planner"',
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    Vary: "Authorization, Cookie",
  });
  res.end("Authentication required");
}

export async function createWsServer(options: WsServerOptions) {
  const {
    port,
    getState,
    router,
    db,
    imagesDir,
    onVapiWebhook,
    onGoogleOAuthCallback,
  } = options;
  const clients = new Set<AuthenticatedClient>();
  let eventSeq = 0;

  const webDistDir = getWebDistDir();
  const authConfig = getBasicAuthConfig();

  const httpServer = createServer(
    (req: IncomingMessage, res: ServerResponse) => {
      // Handle VAPI webhook POST
      if (req.method === "POST" && req.url === "/vapi/webhook") {
        let body = "";
        req.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            if (onVapiWebhook) onVapiWebhook(payload);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400);
            res.end("Invalid JSON");
          }
        });
        return;
      }

      // Handle Google OAuth callback from browser (public web flow)
      const oauthPath = req.url ? req.url.split("?")[0] : "";
      if (req.method === "GET" && oauthPath === "/oauth2/callback") {
        if (!onGoogleOAuthCallback || !req.url) {
          res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
          res.end("<html><body><h1>OAuth no disponible</h1></body></html>");
          return;
        }

        const forwardedProto = (req.headers["x-forwarded-proto"] ?? "")
          .toString()
          .split(",")[0]
          .trim()
          .toLowerCase();
        const scheme =
          forwardedProto || (Boolean((req.socket as any).encrypted) ? "https" : "http");
        const host = req.headers.host ?? `127.0.0.1:${port}`;
        const callbackUrl = `${scheme}://${host}${req.url}`;

        onGoogleOAuthCallback(callbackUrl)
          .then((result) => {
            res.writeHead(result.ok ? 200 : 400, {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store, no-cache, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            });
            res.end(
              `<html><body><h1>${result.ok ? "Authorization complete" : "Authorization failed"}</h1><p>${result.message}</p><p>You can close this tab and return to Open Wedding Planner.</p></body></html>`,
            );
          })
          .catch((err: Error) => {
            res.writeHead(500, {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store, no-cache, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            });
            res.end(
              `<html><body><h1>Authorization failed</h1><p>${err.message}</p></body></html>`,
            );
          });
        return;
      }

      if (!isAuthorized(req, authConfig)) {
        writeUnauthorized(res);
        return;
      }

      setAuthCookie(req, res, authConfig);

      if (req.method !== "GET" || !req.url) {
        res.writeHead(404);
        res.end();
        return;
      }

      // Serve vendor images: GET /images/:vendorId/:filename
      const imageMatch = req.url.match(/^\/images\/(\d+)\/([^/]+)$/);
      if (imageMatch && imagesDir) {
        const [, vendorId, filename] = imageMatch;
        const filePath = path.join(imagesDir, vendorId, filename);
        const resolvedPath = path.resolve(filePath);
        const resolvedImagesDir = path.resolve(imagesDir);
        if (!resolvedPath.startsWith(resolvedImagesDir)) {
          res.writeHead(403);
          res.end();
          return;
        }
        if (!fs.existsSync(filePath)) {
          res.writeHead(404);
          res.end();
          return;
        }
        const ext = path.extname(filename).toLowerCase();
        const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
        res.writeHead(200, {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // Serve web UI static files
      if (fs.existsSync(webDistDir)) {
        const urlPath = req.url.split("?")[0];
        const assetPath = path.join(webDistDir, urlPath);
        const resolvedAsset = path.resolve(assetPath);
        const resolvedWebDist = path.resolve(webDistDir);

        if (resolvedAsset.startsWith(resolvedWebDist)) {
          const isAsset =
            path.extname(urlPath) !== "" && urlPath !== "/index.html";
          if (serveStaticFile(assetPath, res, isAsset)) return;
        }

        // SPA fallback: serve index.html for all non-asset routes
        const indexPath = path.join(webDistDir, "index.html");
        if (serveStaticFile(indexPath, res)) return;
      }

      res.writeHead(404);
      res.end();
    },
  );

  const wss = new WebSocketServer({ server: httpServer });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, resolve);
  });

  const addr = httpServer.address();
  const boundPort =
    typeof addr === "object" && addr !== null ? addr.port : port;

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    if (!isAuthorized(req, authConfig)) {
      ws.close(4003, "Unauthorized");
      return;
    }

    const token = randomBytes(32).toString("hex");
    const client: AuthenticatedClient = {
      ws,
      authenticated: false,
      pendingToken: token,
    };
    clients.add(client);

    send(ws, { type: "challenge", token });

    ws.on("message", (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (msg.type === "challenge-response") {
        if (msg.token === client.pendingToken) {
          client.authenticated = true;
          client.pendingToken = null;
          send(ws, { type: "hello-ok", state: getState() });
        } else {
          ws.close(4001, "Invalid challenge response");
        }
        return;
      }

      if (!client.authenticated) {
        ws.close(4002, "Not authenticated");
        return;
      }

      if (msg.type === "ping") {
        send(ws, { type: "pong" });
        return;
      }

      if (msg.type === "request") {
        if (router && db) {
          router
            .handle(db, msg.method, msg.params)
            .then((result) => {
              send(ws, { type: "response", id: msg.id, ok: true, result });
            })
            .catch((err: Error) => {
              send(ws, {
                type: "response",
                id: msg.id,
                ok: false,
                error: err.message,
              });
            });
        } else {
          send(ws, {
            type: "response",
            id: msg.id,
            ok: false,
            error: `Unknown method: ${msg.method}`,
          });
        }
        return;
      }
    });

    ws.on("close", () => {
      clients.delete(client);
    });
  });

  function send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function broadcast(
    event: Extract<ServerMessage, { type: "event" }>["event"],
  ) {
    eventSeq++;
    const msg: ServerMessage = { type: "event", seq: eventSeq, event };
    for (const client of clients) {
      if (client.authenticated) {
        send(client.ws, msg);
      }
    }
  }

  async function close(): Promise<void> {
    for (const client of clients) {
      client.ws.close(1000, "Server shutting down");
    }
    return new Promise((resolve, reject) => {
      wss.close(() => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });
    });
  }

  return {
    port: boundPort,
    close,
    broadcast,
  };
}
