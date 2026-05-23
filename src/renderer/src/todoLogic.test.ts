import { describe, expect, it } from "vitest";
import type { Todo } from "../../shared/types";
import { findAlertableTodo, sortTodos } from "./todoLogic";

function makeTodo(overrides: Partial<Todo>): Todo {
  return {
    id: "todo-id",
    title: "todo",
    dueAt: "2026-05-23T10:00:00.000Z",
    completed: false,
    createdAt: "2026-05-23T08:00:00.000Z",
    updatedAt: "2026-05-23T08:00:00.000Z",
    ...overrides
  };
}

describe("sortTodos", () => {
  it("sorts incomplete todos by due date before completed todos", () => {
    const late = makeTodo({ id: "late", dueAt: "2026-05-23T12:00:00.000Z" });
    const doneEarly = makeTodo({ id: "done-early", dueAt: "2026-05-23T07:00:00.000Z", completed: true });
    const early = makeTodo({ id: "early", dueAt: "2026-05-23T09:00:00.000Z" });

    expect(sortTodos([late, doneEarly, early]).map((todo) => todo.id)).toEqual(["early", "late", "done-early"]);
  });

  it("does not mutate the input array", () => {
    const late = makeTodo({ id: "late", dueAt: "2026-05-23T12:00:00.000Z" });
    const early = makeTodo({ id: "early", dueAt: "2026-05-23T09:00:00.000Z" });
    const todos = [late, early];

    sortTodos(todos);

    expect(todos.map((todo) => todo.id)).toEqual(["late", "early"]);
  });
});

describe("findAlertableTodo", () => {
  it("returns the earliest todo whose reminder window has started", () => {
    const now = Date.parse("2026-05-23T09:55:00.000Z");
    const laterReady = makeTodo({ id: "later-ready", dueAt: "2026-05-23T10:05:00.000Z" });
    const earliestReady = makeTodo({ id: "earliest-ready", dueAt: "2026-05-23T10:00:00.000Z" });
    const notReady = makeTodo({ id: "not-ready", dueAt: "2026-05-23T10:20:00.000Z" });

    expect(findAlertableTodo([laterReady, notReady, earliestReady], 10, now)?.id).toBe("earliest-ready");
  });

  it("skips completed todos and todos already alerted for the same due date", () => {
    const now = Date.parse("2026-05-23T10:00:00.000Z");
    const completed = makeTodo({ id: "completed", completed: true });
    const alreadyAlerted = makeTodo({
      id: "already-alerted",
      dueAt: "2026-05-23T10:05:00.000Z",
      alertedForDueAt: "2026-05-23T10:05:00.000Z"
    });
    const alertable = makeTodo({ id: "alertable", dueAt: "2026-05-23T10:08:00.000Z" });

    expect(findAlertableTodo([completed, alreadyAlerted, alertable], 10, now)?.id).toBe("alertable");
  });

  it("allows a todo to alert again when its due date changed", () => {
    const now = Date.parse("2026-05-23T10:00:00.000Z");
    const changedDueDate = makeTodo({
      id: "changed",
      dueAt: "2026-05-23T10:08:00.000Z",
      alertedForDueAt: "2026-05-23T09:30:00.000Z"
    });

    expect(findAlertableTodo([changedDueDate], 10, now)?.id).toBe("changed");
  });

  it("returns undefined when no todo is inside the reminder window", () => {
    const now = Date.parse("2026-05-23T09:00:00.000Z");
    const future = makeTodo({ id: "future", dueAt: "2026-05-23T09:30:00.000Z" });

    expect(findAlertableTodo([future], 10, now)).toBeUndefined();
  });
});
