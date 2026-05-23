/// <reference types="vite/client" />

import type { TodoApi, WindowApi } from "../../preload";

declare global {
  interface Window {
    todoApi: TodoApi;
    windowApi: WindowApi;
  }
}
