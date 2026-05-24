import { contextBridge, ipcRenderer } from "electron";
import type { AppState, CatAssets, CatVariant, Settings, Todo, TodoPatch } from "../shared/types.js";

export interface CatBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AlertPayload extends Pick<Todo, "title" | "dueAt"> {
  catBounds?: CatBounds;
  catVariant?: CatVariant;
}

const todoApi = {
  load: (): Promise<AppState> => ipcRenderer.invoke("todos:load"),
  add: (title: string, dueAt: string, memo?: string): Promise<AppState> =>
    ipcRenderer.invoke("todos:add", { title, dueAt, memo }),
  update: (id: string, patch: TodoPatch): Promise<AppState> => ipcRenderer.invoke("todos:update", id, patch),
  delete: (id: string): Promise<AppState> => ipcRenderer.invoke("todos:delete", id),
  markAlerted: (id: string, dueAt: string): Promise<AppState> =>
    ipcRenderer.invoke("todos:mark-alerted", id, dueAt),
  updateSettings: (settings: Partial<Settings>): Promise<AppState> =>
    ipcRenderer.invoke("settings:update", settings)
};

const windowApi = {
  minimize: (): Promise<void> => ipcRenderer.invoke("window:minimize"),
  close: (): Promise<void> => ipcRenderer.invoke("window:close"),
  showAlert: (todo: AlertPayload): Promise<void> => ipcRenderer.invoke("window:show-alert", todo),
  onAlertClosed: (callback: () => void): (() => void) => {
    const listener = (): void => callback();
    ipcRenderer.on("window:alert-closed", listener);
    return () => ipcRenderer.removeListener("window:alert-closed", listener);
  }
};

const assetApi = {
  getCatAssets: (variant?: CatVariant): Promise<CatAssets> => ipcRenderer.invoke("assets:cat", variant)
};

contextBridge.exposeInMainWorld("todoApi", todoApi);
contextBridge.exposeInMainWorld("windowApi", windowApi);
contextBridge.exposeInMainWorld("assetApi", assetApi);

export type AssetApi = typeof assetApi;
export type TodoApi = typeof todoApi;
export type WindowApi = typeof windowApi;
