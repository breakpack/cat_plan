export type TodoStatus = "todo" | "inProgress";

export interface Todo {
  id: string;
  title: string;
  dueAt: string;
  completed: boolean;
  status?: TodoStatus;
  createdAt: string;
  updatedAt: string;
  alertedForDueAt?: string;
}

export interface Settings {
  reminderLeadMinutes: number;
}

export interface AppState {
  todos: Todo[];
  settings: Settings;
}

export interface CatAssets {
  idle: string;
  attack: string;
}

export type TodoPatch = Partial<Pick<Todo, "title" | "dueAt" | "completed" | "status">>;
