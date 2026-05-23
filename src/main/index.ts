import { app, BrowserWindow, ipcMain, screen, type Rectangle } from "electron";
import { readFileSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { fallbackCatAssets } from "../shared/catAssets.js";
import type { AppState, CatAssets, Settings, Todo, TodoPatch } from "../shared/types.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const defaultSettings: Settings = {
  reminderLeadMinutes: 10
};

let mainWindow: BrowserWindow | null = null;
let alertWindow: BrowserWindow | null = null;

interface CatBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AlertPayload extends Pick<Todo, "title" | "dueAt"> {
  catBounds?: CatBounds;
}

const catAssetFiles = {
  idle: "cat01_idle_blink_8fps.gif",
  attack: "cat01_attack_12fps.gif"
};

function getStorePath(): string {
  return join(app.getPath("userData"), "todos.json");
}

function fallbackState(): AppState {
  return {
    todos: [],
    settings: { ...defaultSettings }
  };
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function normalizeState(value: unknown): AppState {
  if (!value || typeof value !== "object") {
    return fallbackState();
  }

  const record = value as Partial<AppState>;
  const todos = Array.isArray(record.todos)
    ? record.todos.filter(isTodo).map((todo) => ({ ...todo }))
    : [];

  const reminderLeadMinutes = Number(record.settings?.reminderLeadMinutes);

  return {
    todos,
    settings: {
      reminderLeadMinutes:
        Number.isFinite(reminderLeadMinutes) && reminderLeadMinutes > 0
          ? Math.round(reminderLeadMinutes)
          : defaultSettings.reminderLeadMinutes
    }
  };
}

function isTodo(value: unknown): value is Todo {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<Todo>;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    isIsoDate(record.dueAt) &&
    typeof record.completed === "boolean" &&
    isIsoDate(record.createdAt) &&
    isIsoDate(record.updatedAt) &&
    (record.alertedForDueAt === undefined || isIsoDate(record.alertedForDueAt))
  );
}

async function readState(): Promise<AppState> {
  try {
    const raw = await readFile(getStorePath(), "utf8");
    return normalizeState(JSON.parse(raw));
  } catch {
    return fallbackState();
  }
}

async function writeState(state: AppState): Promise<AppState> {
  const storePath = getStorePath();
  await mkdir(dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(state, null, 2), "utf8");
  await rename(tempPath, storePath);
  return state;
}

async function updateState(updater: (state: AppState) => AppState): Promise<AppState> {
  const state = await readState();
  return writeState(updater(state));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 320,
    height: 390,
    minWidth: 292,
    minHeight: 320,
    frame: false,
    transparent: false,
    hasShadow: true,
    resizable: true,
    alwaysOnTop: false,
    show: false,
    backgroundColor: "#fbf7ef",
    title: "Cat Todo Widget",
    webPreferences: {
      preload: join(currentDir, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(currentDir, "../renderer/index.html"));
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatAlertDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function readGifDataUrl(fileName: string): string | null {
  const candidates = [
    join(process.resourcesPath, "cat-assets", fileName),
    join(app.getAppPath(), "catset_assets", "catset_gifs", "cat01_gifs", fileName)
  ];

  for (const candidate of candidates) {
    try {
      return `data:image/gif;base64,${readFileSync(candidate).toString("base64")}`;
    } catch {
      // Try the next candidate. The checked-in fallback handles missing local assets.
    }
  }

  return null;
}

function getCatAssets(): CatAssets {
  return {
    idle: readGifDataUrl(catAssetFiles.idle) ?? fallbackCatAssets.idle,
    attack: readGifDataUrl(catAssetFiles.attack) ?? fallbackCatAssets.attack
  };
}

function resolveCatBounds(catBounds: CatBounds | undefined, displayBounds: Rectangle): CatBounds {
  const windowBounds = mainWindow?.getBounds();
  if (!catBounds || !windowBounds) {
    return {
      x: Math.round(displayBounds.width / 2 - 62),
      y: 24,
      width: 124,
      height: 124
    };
  }

  return {
    x: Math.round(windowBounds.x - displayBounds.x + catBounds.x),
    y: Math.round(windowBounds.y - displayBounds.y + catBounds.y),
    width: Math.round(catBounds.width),
    height: Math.round(catBounds.height)
  };
}

function createAlertHtml(todo: AlertPayload, catBounds: CatBounds): string {
  const catAssets = getCatAssets();
  const title = escapeHtml(todo.title);
  const dueAt = escapeHtml(formatAlertDate(todo.dueAt));
  const catCenterX = Math.round(catBounds.x + catBounds.width / 2);
  const catCenterY = Math.round(catBounds.y + catBounds.height / 2);

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <style>
      * { box-sizing: border-box; }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: transparent;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .stage {
        position: fixed;
        inset: 0;
      }
      .backdrop-close {
        position: fixed;
        inset: 0;
        border: 0;
        background: transparent;
        cursor: default;
      }
      .cat {
        position: absolute;
        top: ${catBounds.y}px;
        left: ${catBounds.x}px;
        width: ${catBounds.width}px;
        height: ${catBounds.height}px;
        object-fit: contain;
        image-rendering: pixelated;
        filter: drop-shadow(0 12px 18px rgba(32, 26, 18, 0.3));
        animation: cat-ready 520ms ease-out both;
      }
      .todo {
        position: absolute;
        top: ${catCenterY}px;
        left: ${catCenterX}px;
        display: grid;
        min-width: 280px;
        max-width: min(420px, calc(100vw - 48px));
        gap: 8px;
        border: 1px solid rgba(62, 54, 43, 0.16);
        border-left: 6px solid #2f9e74;
        border-radius: 18px;
        background: rgba(255, 254, 251, 0.98);
        padding: 18px 20px;
        color: #20201d;
        box-shadow: 0 28px 80px rgba(32, 26, 18, 0.3);
        transform-origin: 0 0;
        animation: todo-throw 1400ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .close {
        position: absolute;
        top: 10px;
        right: 10px;
        display: grid;
        width: 28px;
        height: 28px;
        place-items: center;
        border: 0;
        border-radius: 50%;
        background: rgba(32, 32, 29, 0.06);
        color: #5d5850;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
      }
      .close:hover {
        background: rgba(32, 32, 29, 0.12);
      }
      .label {
        color: #d65445;
        font-size: 12px;
        font-weight: 900;
      }
      strong {
        max-width: 100%;
        overflow-wrap: anywhere;
        font-size: 20px;
        letter-spacing: 0;
      }
      span {
        color: #625d54;
        font-size: 13px;
        font-weight: 800;
      }
      @keyframes cat-ready {
        0% { opacity: 0; transform: scale(0.92); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes todo-throw {
        0% { opacity: 0; top: ${catCenterY}px; left: ${catCenterX}px; transform: translate(-50%, -50%) scale(0.48) rotate(-14deg); }
        28% { opacity: 1; top: ${catCenterY}px; left: ${catCenterX}px; transform: translate(-50%, -50%) scale(0.62) rotate(-12deg); }
        72% { opacity: 1; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(1.08) rotate(3deg); }
        86% { transform: translate(-50%, -50%) scale(0.98) rotate(-1deg); }
        100% { opacity: 1; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
      }
    </style>
  </head>
  <body>
    <div class="stage">
      <button class="backdrop-close" type="button" aria-label="알림 닫기"></button>
      <img class="cat" src="${catAssets.attack}" alt="" />
      <article class="todo">
        <button class="close" type="button" aria-label="알림 닫기">×</button>
        <div class="label">다가오는 todo</div>
        <strong>${title}</strong>
        <span>${dueAt}까지</span>
      </article>
    </div>
    <script>
      document.querySelectorAll('[aria-label="알림 닫기"]').forEach((button) => {
        button.addEventListener('click', () => window.close());
      });
      window.setTimeout(() => {
        document.querySelector('.cat').src = '${catAssets.idle}';
      }, 900);
      window.setTimeout(() => window.close(), 8000);
    </script>
  </body>
</html>`;
}

function showTodoAlert(todo: AlertPayload): void {
  alertWindow?.close();

  const { bounds } = screen.getPrimaryDisplay();
  const catBounds = resolveCatBounds(todo.catBounds, bounds);
  alertWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  alertWindow.setAlwaysOnTop(true, "screen-saver");
  alertWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  alertWindow.once("closed", () => {
    alertWindow = null;
    mainWindow?.webContents.send("window:alert-closed");
  });
  alertWindow.once("ready-to-show", () => {
    alertWindow?.showInactive();
  });
  void alertWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(createAlertHtml(todo, catBounds))}`).then(() => {
    if (!alertWindow?.isDestroyed()) {
      alertWindow?.showInactive();
    }
  });
  setTimeout(() => {
    if (!alertWindow?.isDestroyed()) {
      alertWindow?.close();
    }
  }, 8200);
}

app.whenReady().then(() => {
  ipcMain.handle("assets:cat", () => getCatAssets());

  ipcMain.handle("todos:load", () => readState());

  ipcMain.handle("todos:add", async (_event, payload: { title: string; dueAt: string }) => {
    const title = payload.title.trim();
    if (!title || !isIsoDate(payload.dueAt)) {
      throw new Error("Invalid todo payload.");
    }

    const now = new Date().toISOString();
    const todo: Todo = {
      id: randomUUID(),
      title,
      dueAt: new Date(payload.dueAt).toISOString(),
      completed: false,
      createdAt: now,
      updatedAt: now
    };

    return updateState((state) => ({
      ...state,
      todos: [...state.todos, todo]
    }));
  });

  ipcMain.handle("todos:update", async (_event, id: string, patch: TodoPatch) => {
    return updateState((state) => ({
      ...state,
      todos: state.todos.map((todo) => {
        if (todo.id !== id) {
          return todo;
        }

        const dueAt = patch.dueAt && isIsoDate(patch.dueAt) ? new Date(patch.dueAt).toISOString() : todo.dueAt;
        const title = typeof patch.title === "string" && patch.title.trim() ? patch.title.trim() : todo.title;
        const completed = typeof patch.completed === "boolean" ? patch.completed : todo.completed;
        const dueChanged = dueAt !== todo.dueAt;

        return {
          ...todo,
          title,
          dueAt,
          completed,
          alertedForDueAt: dueChanged ? undefined : todo.alertedForDueAt,
          updatedAt: new Date().toISOString()
        };
      })
    }));
  });

  ipcMain.handle("todos:delete", async (_event, id: string) => {
    return updateState((state) => ({
      ...state,
      todos: state.todos.filter((todo) => todo.id !== id)
    }));
  });

  ipcMain.handle("todos:mark-alerted", async (_event, id: string, dueAt: string) => {
    return updateState((state) => ({
      ...state,
      todos: state.todos.map((todo) =>
        todo.id === id && todo.dueAt === dueAt
          ? { ...todo, alertedForDueAt: dueAt, updatedAt: new Date().toISOString() }
          : todo
      )
    }));
  });

  ipcMain.handle("settings:update", async (_event, settings: Partial<Settings>) => {
    const reminderLeadMinutes = Number(settings.reminderLeadMinutes);
    return updateState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        reminderLeadMinutes:
          Number.isFinite(reminderLeadMinutes) && reminderLeadMinutes > 0
            ? Math.min(1440, Math.round(reminderLeadMinutes))
            : state.settings.reminderLeadMinutes
      }
    }));
  });

  ipcMain.handle("window:minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.handle("window:close", () => {
    mainWindow?.close();
  });

  ipcMain.handle("window:show-alert", (_event, todo: AlertPayload) => {
    if (typeof todo.title !== "string" || !isIsoDate(todo.dueAt)) {
      throw new Error("Invalid alert payload.");
    }
    showTodoAlert(todo);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
