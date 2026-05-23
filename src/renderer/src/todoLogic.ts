import type { Todo } from "../../shared/types";

export function sortTodos(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
}

export function findAlertableTodo(todos: Todo[], reminderLeadMinutes: number, now = Date.now()): Todo | undefined {
  return sortTodos(todos).find((todo) => {
    if (todo.completed || todo.alertedForDueAt === todo.dueAt) {
      return false;
    }

    const alertAt = new Date(todo.dueAt).getTime() - reminderLeadMinutes * 60_000;
    return now >= alertAt;
  });
}
