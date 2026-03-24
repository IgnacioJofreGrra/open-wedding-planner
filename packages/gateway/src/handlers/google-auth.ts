import type { Router } from "../infra/router.js";
import type { GogManager } from "../infra/gog-manager.js";
import { googleConfig } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { createServer, type Server } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { getDataDir } from "../config/paths.js";
import type { ChildProcess } from "node:child_process";

interface PendingGoogleOAuth {
  child: ChildProcess;
  email: string;
  originalRedirectUri: string;
  timeoutId: NodeJS.Timeout;
}

export interface GoogleOAuthCallbackResult {
  ok: boolean;
  message: string;
}

export function registerGoogleAuthHandlers(router: Router, gogManager: GogManager) {
  const pendingOAuthByState = new Map<string, PendingGoogleOAuth>();

  function resolvePublicBaseUrl(raw: string | undefined): string | null {
    if (!raw) return null;
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return null;
    }
    return parsed.origin;
  }

  async function handleOAuthCallback(
    callbackUrl: string,
  ): Promise<GoogleOAuthCallbackResult> {
    let parsed: URL;
    try {
      parsed = new URL(callbackUrl);
    } catch {
      return { ok: false, message: "OAuth callback URL invalida" };
    }

    const state = parsed.searchParams.get("state");
    if (!state) {
      return { ok: false, message: "OAuth callback sin state" };
    }

    const pending = pendingOAuthByState.get(state);
    if (!pending) {
      return {
        ok: false,
        message: "No hay una autorizacion OAuth pendiente o ya expiro.",
      };
    }

    pendingOAuthByState.delete(state);
    clearTimeout(pending.timeoutId);

    const localCallback = new URL(pending.originalRedirectUri);
    localCallback.search = parsed.search;

    if (!pending.child.stdin) {
      return {
        ok: false,
        message: "No se pudo completar OAuth (stdin no disponible).",
      };
    }

    console.log(`Google OAuth callback received for ${pending.email}`);
    pending.child.stdin.write(localCallback.toString() + "\n");
    pending.child.stdin.end();

    pending.child.on("close", (code) => {
      if (code === 0) {
        console.log(`Google account ${pending.email} connected successfully`);
      } else {
        console.error(`gog auth exited with code ${code}`);
      }
    });

    return {
      ok: true,
      message: "Autorizacion completada. Ya puedes volver a Open Wedding Planner.",
    };
  }

  // Save credentials — accepts either a file path or raw JSON content
  router.register("google.set-credentials", async (db, params) => {
    const { credentialsPath, credentialsJson } = params as {
      credentialsPath?: string;
      credentialsJson?: string;
    };

    let filePath = credentialsPath;

    // If raw JSON was pasted, write it to a file
    if (credentialsJson) {
      let parsed = JSON.parse(credentialsJson);

      // If user pasted just { client_id, client_secret }, wrap in the format gog expects
      if (parsed.client_id && parsed.client_secret && !parsed.installed && !parsed.web) {
        parsed = {
          installed: {
            client_id: parsed.client_id,
            client_secret: parsed.client_secret,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            redirect_uris: ["http://localhost"],
          },
        };
      }

      filePath = path.join(getDataDir(), "google-credentials.json");
      fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), "utf-8");
    }

    if (!filePath) throw new Error("Provide either credentialsPath or credentialsJson");

    // Run gog auth credentials to register the OAuth client
    await gogManager.exec(["auth", "credentials", filePath]);

    // Upsert config
    const [existing] = await db.select().from(googleConfig).limit(1);
    if (existing) {
      await db
        .update(googleConfig)
        .set({ credentialsPath: filePath })
        .where(eq(googleConfig.id, existing.id));
    } else {
      await db.insert(googleConfig).values({ credentialsPath: filePath });
    }

    return { ok: true };
  });

  // Start OAuth flow — returns auth URL for the frontend to open
  router.register("google.connect", async (db, params) => {
    const { email, services, publicBaseUrl } = params as {
      email: string;
      services: string[];
      publicBaseUrl?: string;
    };

    const serviceArg = services.join(",");

    // Clear any cached gog state for this email so scopes reflect current selection
    try {
      await gogManager.exec(["auth", "remove", email, "--force"]);
    } catch {
      // Not connected yet — ignore
    }

    // Spawn gog in --manual mode: it prints the auth URL, then waits for
    // the redirect URL on stdin. We capture the URL, start our own callback
    // server on gog's expected port, and pipe the callback URL back.
    const child = await gogManager.spawnProcess([
      "auth", "add", email,
      "--services", serviceArg,
      "--manual",
    ]);

    // Collect stdout to extract the auth URL
    const rawAuthUrl = await new Promise<string>((resolve, reject) => {
      let output = "";
      const timeout = setTimeout(() => reject(new Error("Timed out waiting for auth URL from gog")), 10000);

      child.stderr!.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        const match = output.match(/https:\/\/accounts\.google\.com\S+/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[0]);
        }
      });

      child.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      child.on("close", (code) => {
        clearTimeout(timeout);
        if (!output.includes("accounts.google.com")) {
          reject(new Error(`gog exited (code ${code}) without printing auth URL. Output: ${output}`));
        }
      });
    });

    const authUrlObj = new URL(rawAuthUrl);
    const redirectUri = authUrlObj.searchParams.get("redirect_uri");
    if (!redirectUri) {
      child.kill();
      throw new Error(`No redirect_uri in auth URL: ${rawAuthUrl}`);
    }

    const publicOrigin =
      resolvePublicBaseUrl(publicBaseUrl) ??
      resolvePublicBaseUrl(process.env.WP_PUBLIC_BASE_URL);

    let authUrl = rawAuthUrl;
    const state = authUrlObj.searchParams.get("state");

    if (publicOrigin && state) {
      const publicRedirect = new URL("/oauth2/callback", publicOrigin).toString();
      authUrlObj.searchParams.set("redirect_uri", publicRedirect);
      authUrl = authUrlObj.toString();

      const timeoutId = setTimeout(() => {
        pendingOAuthByState.delete(state);
      }, 5 * 60 * 1000);

      pendingOAuthByState.set(state, {
        child,
        email,
        originalRedirectUri: redirectUri,
        timeoutId,
      });
    } else {
      const redirectUrl = new URL(redirectUri);
      const callbackPort = parseInt(redirectUrl.port || "80", 10);
      const callbackPath = redirectUrl.pathname;

      // Fallback for local desktop/Electron flows.
      const waitForCallback = listenForCallback(callbackPort, callbackPath);

      // When our callback server receives the redirect, pipe the URL to gog's stdin
      waitForCallback.then(async (callbackUrl) => {
        console.log(`Google OAuth callback received for ${email}`);
        child.stdin!.write(callbackUrl + "\n");
        child.stdin!.end();

        child.on("close", (code) => {
          if (code === 0) {
            console.log(`Google account ${email} connected successfully`);
          } else {
            console.error(`gog auth exited with code ${code}`);
          }
        });
      });
    }

    // Store connection info
    const [existing] = await db.select().from(googleConfig).limit(1);
    const values = {
      accountEmail: email,
      services: serviceArg,
    };
    if (existing) {
      await db.update(googleConfig).set(values).where(eq(googleConfig.id, existing.id));
    } else {
      await db.insert(googleConfig).values(values);
    }

    return { authUrl };
  });

  router.register("google.disconnect", async (db) => {
    const [config] = await db.select().from(googleConfig).limit(1);
    if (!config?.accountEmail) throw new Error("No Google account connected");

    try {
      await gogManager.exec(["auth", "remove", config.accountEmail, "--force"]);
    } catch {
      // Ignore — account may already be removed from gog
    }

    await db
      .update(googleConfig)
      .set({ accountEmail: null })
      .where(eq(googleConfig.id, config.id));

    return { ok: true };
  });

  router.register("google.status", async (db) => {
    const [config] = await db.select().from(googleConfig).limit(1);
    return {
      connected: !!config?.accountEmail,
      email: config?.accountEmail ?? null,
      services: config?.services?.split(",") ?? [],
      autoSend: config?.autoSend === 1,
      hasCredentials: !!config?.credentialsPath,
    };
  });

  router.register("google.update-auto-send", async (db, params) => {
    const { autoSend } = params as { autoSend: boolean };
    const [existing] = await db.select().from(googleConfig).limit(1);
    if (existing) {
      await db
        .update(googleConfig)
        .set({ autoSend: autoSend ? 1 : 0 })
        .where(eq(googleConfig.id, existing.id));
    }
    return { ok: true };
  });

  return {
    handleOAuthCallback,
  };
}

/** Spins up a one-shot HTTP server on the exact port/path gog expects for the OAuth redirect */
function listenForCallback(port: number, expectedPath: string): Promise<string> {
  return new Promise((resolve) => {
    const server: Server = createServer((req, res) => {
      const reqUrl = new URL(req.url!, `http://127.0.0.1:${port}`);
      if (reqUrl.pathname !== expectedPath) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const fullUrl = `http://127.0.0.1:${port}${req.url}`;
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body><h1>Authorization complete!</h1><p>You can close this tab and return to the app.</p></body></html>");
      server.close();
      resolve(fullUrl);
    });

    server.listen(port, "127.0.0.1");

    // Auto-close after 5 minutes if no callback
    setTimeout(() => {
      server.close();
    }, 5 * 60 * 1000);
  });
}
