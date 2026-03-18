# Open Wedding Planner

Idioma / Language: [Español](#espanol) | [English](#english)

<a id="espanol"></a>
<details open>
<summary><strong>Español</strong></summary>

Aplicación de escritorio en Electron impulsada por IA para planificar una boda. Combina investigación de proveedores, seguimiento de presupuesto, mensajería por WhatsApp y un backend de IA agéntica en una sola app que corre completamente en tu máquina.

## Funcionalidades

### Investigación con IA

Chatea con un agente de IA en hilos de investigación persistentes. El agente puede buscar en la web (DuckDuckGo por defecto, Brave Search opcional), extraer información de sitios de proveedores, parsear PDFs y crear automáticamente registros de proveedores con imágenes. Para sitios cargados con JavaScript, lanza un subagente de navegador Chromium headless que puede navegar, hacer clic, desplazarse y extraer contenido. Se pueden ejecutar múltiples subagentes de navegador en paralelo.

Comandos slash en el chat de investigación:

- `/compact` — resume la conversación para liberar ventana de contexto
- `/clear` — elimina todos los mensajes del hilo
- `/model <name>` — cambia el modelo de IA durante la sesión

### Gestión de Proveedores

Gestiona proveedores por categoría (Lugar, Comida/Bebida, Fotografía, etc.) con progresión de estado: `researched → contacted → quoted → booked` (o `rejected`). Cada proveedor tiene una página de detalle con información de contacto, cotizaciones, galería de fotos, atributos personalizados y un hilo de conversación vinculado de WhatsApp/correo. La vista de listado soporta modo grilla y tabla, filtros por categoría/estado/favoritos y ordenamiento.

### Presupuesto

Asignación de presupuesto por categoría con ítems de cotización y seguimiento de gasto real. Una barra de resumen muestra presupuesto total, gasto comprometido y saldo restante.

### WhatsApp

Conecta tu cuenta personal de WhatsApp mediante escaneo de código QR (usa la librería Baileys, no requiere WhatsApp Business API). Envía y recibe mensajes con proveedores directamente desde la app. Los mensajes salientes pueden enviarse de inmediato o encolarse como borradores para aprobación antes del envío. Los mensajes entrantes se vinculan a los registros de proveedores.

También puedes interactuar con el agente de investigación enviándote mensajes a ti mismo por WhatsApp. Usa `/new` para iniciar un nuevo hilo de investigación y `/status` para revisar la cola de entrega.

### Llamadas de Voz (VAPI)

Realiza llamadas salientes a proveedores mediante [VAPI](https://vapi.ai). El agente de IA puede iniciar una llamada, hablar con el proveedor en tu nombre y, cuando termina, la app guarda la transcripción completa, un resumen generado por IA, extracción de datos estructurados y la URL de grabación. El estado de la llamada se sigue en tiempo real (queued → ringing → in-progress → ended) con actualizaciones en vivo por WebSocket. Después de una llamada puedes abrir un panel de chat con IA para hacer preguntas de seguimiento sobre la conversación.

Requiere una cuenta de VAPI con API key, número telefónico aprovisionado y un assistant. Configúralo en **Settings → VAPI**.

### Agente de Outreach

Lanza un agente de IA para redactar y enviar mensajes de contacto a proveedores. Soporta WhatsApp y Gmail (vía CLI `gog`, descargada automáticamente en el primer uso). Los borradores pueden revisarse y aprobarse antes de enviar.

### Inbox

Vista unificada de todas las comunicaciones entrantes de proveedores a través de canales.

### Timeline

Seguimiento de tareas e hitos para la boda.

### Búsqueda Semántica

Embeddings vectoriales (OpenAI `text-embedding-3-small`) almacenados en SQLite mediante `sqlite-vec`. Los agentes los usan para buscar entre proveedores y notas de investigación.

### Túnel Cloudflare

Expone el gateway local a internet mediante una URL temporal de `trycloudflare.com`, sin cuenta ni port forwarding. Puedes activarlo/desactivarlo desde Settings. La URL se muestra en la interfaz y se puede copiar.

### Importación CSV

Importa datos de proveedores y presupuesto desde archivos CSV.

### Consola de Depuración

Presiona `Cmd+Shift+D` (o `Ctrl+Shift+D`) para abrir un stream en vivo de logs del gateway.

### Modo Web UI

El gateway también sirve el frontend React como archivos estáticos, así puedes abrir la app en un navegador sin Electron (útil para acceso remoto a través del túnel).

---

## Arquitectura

Este proyecto es un monorepo con npm workspaces y tres paquetes:

```
packages/
  shared/    # Tipos TypeScript compartidos, esquemas Zod y constantes
  gateway/   # Backend Node.js: servidor WebSocket, DB SQLite, agentes IA, herramientas
  app/       # Shell de Electron: proceso principal + renderer React
```

El proceso principal de Electron lanza el gateway como proceso hijo de Node.js (usando el binario del sistema `node`, no el de Electron, para que módulos nativos como `better-sqlite3` funcionen correctamente). El renderer se conecta al gateway por WebSocket local con autenticación challenge-response. El gateway maneja toda la lógica de datos, IA y mensajería, y emite eventos en tiempo real hacia la UI.

Todos los datos persistentes se guardan en `~/.wedding-planner/`:

- `data.db` — base de datos SQLite
- `whatsapp-auth/` — credenciales de sesión de Baileys
- `images/` — fotos de proveedores descargadas
- `delivery-queue/` — cola de mensajes salientes (sobrevive reinicios)
- `workspace/` — directorio de trabajo del agente para la herramienta `cmd`
- `bin/` — binario CLI `gog` descargado automáticamente

---

## Requisitos Previos

- **Node.js 22+**
- **Playwright Chromium** — requerido para la herramienta de subagente de navegador:
  ```bash
  npx playwright install chromium
  ```

---

## Instalación

```bash
# Instala todas las dependencias (también descarga cloudflared vía postinstall)
npm install

# Compila el paquete shared (requerido antes de ejecutar cualquier cosa)
npm run build -w @wedding-planner/shared
```

---

## Desarrollo

Inicia todos los paquetes en modo watch:

```bash
npm run dev
```

O por separado:

```bash
npm run dev:shared    # tsc --watch para tipos compartidos
npm run dev:gateway   # tsup --watch para el gateway
npm run dev:app       # electron-vite dev (abre la ventana de Electron)
```

---

## Build y Empaquetado

```bash
# Compila todos los paquetes
npm run build

# Empaqueta la app de Electron en un distribuible
npm run package -w @wedding-planner/app
```

El script `package`:

1. Copia el Playwright headless shell en `packages/app/browsers/` (ejecuta antes `npx playwright install chromium`)
2. Descarga el binario `cloudflared` en `packages/app/cloudflared/`
3. Compila todos los paquetes
4. Ejecuta `electron-builder`

Objetivos de salida: DMG para macOS (arm64 + x64), instalador NSIS para Windows (x64), AppImage para Linux (x64).

---

## Configuración

Todo se configura desde la pantalla de Settings dentro de la app y se almacena en SQLite.

| Sección          | Qué hace                                                                                                                                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wedding Config   | Fecha, cantidad de invitados, presupuesto total, moneda, nombres de la pareja, ubicación, preferencias de idioma, notas de dieta/alcohol                                            |
| AI Provider      | Elige entre Anthropic (por defecto), OpenAI, Google Gemini, OpenRouter, Ollama (local) o cualquier endpoint compatible con OpenAI. Modelo por defecto: `claude-sonnet-4-20250514`. |
| OpenAI API Key   | Clave separada para embeddings de búsqueda semántica (`text-embedding-3-small`). Opcional: sin ella la búsqueda semántica se desactiva.                                              |
| Search Provider  | **DuckDuckGo** (por defecto, sin clave) o **Brave Search** (requiere API key de Brave Search).                                                                                       |
| Heartbeat        | Agente programado opcional con intervalo configurable (30 min por defecto). Ejecuta chequeos de salud y opcionalmente un prompt de investigación personalizado.                      |
| Tool Permissions | Aprobación por herramienta: controla qué herramientas del agente requieren confirmación explícita del usuario antes de ejecutarse.                                                    |
| Guardrails       | Reglas de seguridad aplicadas a las salidas del agente.                                                                                                                               |
| VAPI             | Credenciales de llamadas de voz: API key, phone number ID y assistant ID.                                                                                                             |
| Integrations     | Configuración de QR de WhatsApp, toggle de auto-send y Google Services (Gmail vía CLI `gog`).                                                                                        |
| Internet Tunnel  | Iniciar/detener el túnel de Cloudflare.                                                                                                                                               |
| Data Management  | Exportar o limpiar datos de la aplicación.                                                                                                                                            |

### Proveedor de IA

Soporta seis opciones de proveedor:

| Proveedor | API Key | Notas |
|----------|---------|-------|
| **Anthropic** (por defecto) | `sk-ant-api03-...` u OAuth token vía `claude setup-token` | Herramientas integradas de búsqueda y fetch web. |
| **OpenAI** | `sk-...` de platform.openai.com | GPT-4o, o1, o3, etc. |
| **Google Gemini** | `AIza...` de aistudio.google.com | Gemini 2.5 Pro, etc. |
| **OpenRouter** | `sk-or-...` de openrouter.ai | Cientos de modelos tras una sola API. |
| **Ollama** | No requiere | Corre localmente en `localhost:11434`. Totalmente offline. |
| **Custom** | Opcional | Cualquier endpoint compatible con OpenAI. Requiere base URL. |

Los proveedores distintos de Anthropic usan herramientas personalizadas de búsqueda/scraping en lugar de `web_search`/`web_fetch` integradas de Anthropic.

---

## Tests

```bash
npm test
```

318 tests en 57 archivos dentro de `packages/gateway/`, usando Vitest.

## Verificación de Tipos

```bash
npm run typecheck
```

</details>

---

<a id="english"></a>
<details>
<summary><strong>English</strong></summary>

## English

AI-powered Electron desktop app for planning a wedding. It combines vendor research, budget tracking, WhatsApp messaging, and an agentic AI backend into a single application that runs entirely on your machine.

## Features

### AI Research

Chat with an AI agent in persistent research threads. The agent can search the web (DuckDuckGo by default, Brave Search optional), scrape vendor websites, parse PDFs, and automatically create vendor records with images. For JavaScript-heavy sites it spawns a headless Chromium browser subagent that can navigate, click, scroll, and extract content. Multiple browser subagents can run in parallel.

Slash commands in the research chat:

- `/compact` — summarize the conversation to free up context window
- `/clear` — wipe all messages in the thread
- `/model <name>` — switch the AI model mid-session

### Vendor Management

Track vendors by category (Venue, Food/Beverage, Photography, etc.) with status progression: `researched → contacted → quoted → booked` (or `rejected`). Each vendor has a detail page with contact info, quotes, a photo gallery, custom attributes, and a linked WhatsApp/email conversation thread. The list view supports grid and table modes, filtering by category/status/favorites, and sorting.

### Budget

Category-based budget allocation with quote line items and actual spend tracking. A summary bar shows total budget, committed spend, and remaining balance.

### WhatsApp

Connect your personal WhatsApp account via QR code scan (uses the Baileys library — no WhatsApp Business API required). Send and receive messages with vendors directly from the app. Outbound messages can be sent immediately or queued as drafts for approval before sending. Incoming messages are linked to vendor records.

You can also interact with the research agent by sending messages to yourself on WhatsApp. Use `/new` to start a new research thread and `/status` to check the delivery queue.

### Voice Calling (VAPI)

Make outbound phone calls to vendors via [VAPI](https://vapi.ai). The AI agent can initiate a call, speak to the vendor on your behalf, and when the call ends the app stores a full transcript, an AI-generated summary, structured data extraction, and a recording URL. Call status is tracked in real time (queued → ringing → in-progress → ended) with live UI updates via WebSocket. After a call you can open an AI chat panel to ask follow-up questions about the conversation.

Requires a VAPI account with an API key, a provisioned phone number, and an assistant. Configure these in **Settings → VAPI**.

### Outreach Agent

Dispatch an AI agent to draft and send outreach messages to vendors. Supports WhatsApp and Gmail (via the `gog` CLI, auto-downloaded on first use). Drafts can be reviewed and approved before sending.

### Inbox

Unified view of all incoming vendor communications across channels.

### Timeline

Task and milestone tracking for the wedding.

### Semantic Search

Vector embeddings (OpenAI `text-embedding-3-small`) stored in SQLite via `sqlite-vec`. Used by agents to search across vendors and research notes.

### Cloudflare Tunnel

Expose the local gateway to the internet via a temporary `trycloudflare.com` URL — no account or port forwarding required. Toggle on/off from Settings. The URL is shown and copyable in the UI.

### CSV Import

Import vendor and budget data from CSV files.

### Debug Console

Press `Cmd+Shift+D` (or `Ctrl+Shift+D`) to open a live stream of gateway logs.

### Web UI Mode

The gateway also serves the React frontend as static files, so you can open the app in a browser without Electron (useful for remote access via the tunnel).

---

## Architecture

This is an npm workspaces monorepo with three packages:

```
packages/
  shared/    # Shared TypeScript types, Zod schemas, and constants
  gateway/   # Node.js backend — WebSocket server, SQLite DB, AI agents, tools
  app/       # Electron shell — main process + React renderer
```

The Electron main process spawns the gateway as a child Node.js process (using the system `node` binary, not Electron's, so native modules like `better-sqlite3` work correctly). The renderer connects to the gateway over a local WebSocket with challenge-response authentication. The gateway handles all data, AI, and messaging logic and broadcasts real-time events back to the UI.

All persistent data lives in `~/.wedding-planner/`:

- `data.db` — SQLite database
- `whatsapp-auth/` — Baileys session credentials
- `images/` — downloaded vendor photos
- `delivery-queue/` — outbound message queue (survives restarts)
- `workspace/` — agent working directory for the `cmd` tool
- `bin/` — auto-downloaded `gog` CLI binary

---

## Prerequisites

- **Node.js 22+**
- **Playwright Chromium** — required for the browser subagent tool:
  ```bash
  npx playwright install chromium
  ```

---

## Setup

```bash
# Install all dependencies (also auto-downloads the cloudflared binary via postinstall)
npm install

# Build the shared package (required before running anything else)
npm run build -w @wedding-planner/shared
```

---

## Development

Start all packages in watch mode:

```bash
npm run dev
```

Or individually:

```bash
npm run dev:shared    # tsc --watch for shared types
npm run dev:gateway   # tsup --watch for the gateway
npm run dev:app       # electron-vite dev (opens Electron window)
```

---

## Building & Packaging

```bash
# Compile all packages
npm run build

# Package the Electron app into a distributable
npm run package -w @wedding-planner/app
```

The `package` script:

1. Copies the Playwright headless shell into `packages/app/browsers/` (run `npx playwright install chromium` first)
2. Downloads the `cloudflared` binary into `packages/app/cloudflared/`
3. Builds all packages
4. Runs `electron-builder`

Output targets: macOS DMG (arm64 + x64), Windows NSIS installer (x64), Linux AppImage (x64).

---

## Configuration

Everything is configured through the in-app Settings screen and stored in the SQLite database.

| Section          | What it does                                                                                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wedding Config   | Date, guest count, total budget, currency, couple names, location, language preferences, dietary/alcohol notes                                                                          |
| AI Provider      | Choose from Anthropic (default), OpenAI, Google Gemini, OpenRouter, Ollama (local), or any OpenAI-compatible endpoint. Default model: `claude-sonnet-4-20250514`.                       |
| OpenAI API Key   | Separate key for semantic search embeddings (`text-embedding-3-small`). Optional — semantic search is disabled without it.                                                              |
| Search Provider  | **DuckDuckGo** (default, no key needed) or **Brave Search** (requires a Brave Search API key).                                                                                          |
| Heartbeat        | Optional scheduled agent that runs on a configurable interval (default 30 min). Runs health checks (stalled tasks, unparsed messages) and optionally executes a custom research prompt. |
| Tool Permissions | Per-tool approval settings — control which agent tools require explicit user confirmation before running.                                                                               |
| Guardrails       | Safety rules applied to agent outputs.                                                                                                                                                  |
| VAPI             | Voice calling credentials — API key, phone number ID, and assistant ID.                                                                                                                 |
| Integrations     | WhatsApp QR code setup, auto-send toggle, Google Services (Gmail via `gog` CLI).                                                                                                       |
| Internet Tunnel  | Start/stop the Cloudflare tunnel.                                                                                                                                                       |
| Data Management  | Export or clear application data.                                                                                                                                                       |

### AI Provider

Supports six provider options:

| Provider | API Key | Notes |
|----------|---------|-------|
| **Anthropic** (default) | `sk-ant-api03-...` or OAuth token via `claude setup-token` | Built-in web search and web fetch tools. |
| **OpenAI** | `sk-...` from platform.openai.com | GPT-4o, o1, o3, etc. |
| **Google Gemini** | `AIza...` from aistudio.google.com | Gemini 2.5 Pro, etc. |
| **OpenRouter** | `sk-or-...` from openrouter.ai | Hundreds of models behind one API. |
| **Ollama** | None needed | Runs locally at `localhost:11434`. Fully offline. |
| **Custom** | Optional | Any OpenAI-compatible endpoint. Provide a base URL. |

Non-Anthropic providers fall back to custom search/scrape tools instead of Anthropic's built-in web_search/web_fetch.

---

## Tests

```bash
npm test
```

318 tests across 57 files in `packages/gateway/`, using Vitest.

## Type Checking

```bash
npm run typecheck
```

</details>
