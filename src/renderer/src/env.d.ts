/// <reference types="vite/client" />

import type { AssetApi, TodoApi, WindowApi } from "../../preload";

declare global {
  interface Window {
    assetApi: AssetApi;
    todoApi: TodoApi;
    windowApi: WindowApi;
  }
}
