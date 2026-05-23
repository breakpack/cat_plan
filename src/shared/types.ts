export interface Todo {
  id: string;
  title: string;
  dueAt: string;
  completed: boolean;
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

export type TodoPatch = Partial<Pick<Todo, "title" | "dueAt" | "completed">>;
