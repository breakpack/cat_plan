import {
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Minus,
  Plus,
  Save,
  Settings,
  Trash2,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { AppState, Todo } from "../../shared/types";
import { catIdleDataUrl } from "../../shared/catAssets";
import { findAlertableTodo, sortTodos } from "./todoLogic";

const reminderPresets = [5, 10, 30, 60];
const defaultState: AppState = {
  todos: [],
  settings: {
    reminderLeadMinutes: 10
  }
};

interface Draft {
  title: string;
  duePicker: string;
}

interface AlertTodo {
  todo: Todo;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function toDateTimeLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

function toReadableDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function formatRemaining(dueAt: string): string {
  const diff = new Date(dueAt).getTime() - Date.now();
  const absMinutes = Math.max(1, Math.round(Math.abs(diff) / 60000));

  if (diff < 0) {
    if (absMinutes >= 1440) {
      return `${Math.floor(absMinutes / 1440)}일 지남`;
    }
    if (absMinutes >= 60) {
      return `${Math.floor(absMinutes / 60)}시간 지남`;
    }
    return `${absMinutes}분 지남`;
  }

  if (absMinutes >= 1440) {
    return `${Math.floor(absMinutes / 1440)}일 남음`;
  }
  if (absMinutes >= 60) {
    return `${Math.floor(absMinutes / 60)}시간 ${absMinutes % 60}분 남음`;
  }
  return `${absMinutes}분 남음`;
}

function getDueFromDraft(draft: Draft): Date | null {
  if (draft.duePicker) {
    const picked = new Date(draft.duePicker);
    return Number.isFinite(picked.getTime()) ? picked : null;
  }

  return null;
}

function App(): React.ReactElement {
  const catRef = useRef<HTMLImageElement>(null);
  const throwTimerRef = useRef<number | undefined>(undefined);
  const [state, setState] = useState<AppState>(defaultState);
  const [draft, setDraft] = useState<Draft>({ title: "", duePicker: "" });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>({ title: "", duePicker: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [customReminder, setCustomReminder] = useState("10");
  const [alertTodo, setAlertTodo] = useState<AlertTodo | null>(null);
  const [isThrowing, setIsThrowing] = useState(false);

  const sortedTodos = useMemo(() => sortTodos(state.todos), [state.todos]);
  const activeTodos = sortedTodos.filter((todo) => !todo.completed);
  const completedTodos = sortedTodos.filter((todo) => todo.completed);

  function restoreWidgetCat(): void {
    setIsThrowing(false);
    if (throwTimerRef.current !== undefined) {
      window.clearTimeout(throwTimerRef.current);
      throwTimerRef.current = undefined;
    }
  }

  useEffect(() => {
    void window.todoApi.load().then((loaded) => {
      setState(loaded);
      setCustomReminder(String(loaded.settings.reminderLeadMinutes));
    });

    const unsubscribeAlertClosed = window.windowApi.onAlertClosed(restoreWidgetCat);

    return () => {
      unsubscribeAlertClosed();
      if (throwTimerRef.current !== undefined) {
        window.clearTimeout(throwTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const tick = (): void => {
      const todo = findAlertableTodo(state.todos, state.settings.reminderLeadMinutes);
      if (!todo || alertTodo?.todo.id === todo.id) {
        return;
      }

      setAlertTodo({ todo });
      showThrowAlert(todo);
      void window.todoApi.markAlerted(todo.id, todo.dueAt).then(setState);
    };

    tick();
    const timer = window.setInterval(tick, 15_000);
    return () => window.clearInterval(timer);
  }, [alertTodo?.todo.id, state.settings.reminderLeadMinutes, state.todos]);

  useEffect(() => {
    if (!alertTodo) {
      return undefined;
    }

    const timer = window.setTimeout(() => setAlertTodo(null), 8000);
    return () => window.clearTimeout(timer);
  }, [alertTodo]);

  function showThrowAlert(todo: Pick<Todo, "title" | "dueAt">): void {
    const catBounds = catRef.current?.getBoundingClientRect();

    setIsThrowing(true);
    if (throwTimerRef.current !== undefined) {
      window.clearTimeout(throwTimerRef.current);
    }
    throwTimerRef.current = window.setTimeout(() => {
      setIsThrowing(false);
      throwTimerRef.current = undefined;
    }, 8200);

    void window.windowApi.showAlert({
      title: todo.title,
      dueAt: todo.dueAt,
      catBounds: catBounds
        ? {
            x: catBounds.x,
            y: catBounds.y,
            width: catBounds.width,
            height: catBounds.height
          }
        : undefined
    });
  }

  async function submitTodo(event: FormEvent): Promise<void> {
    event.preventDefault();
    const title = draft.title.trim();
    const dueAt = getDueFromDraft(draft);

    if (!title) {
      setError("제목을 입력해 주세요.");
      return;
    }
    if (!dueAt) {
      setError("달력에서 기한 날짜와 시간을 선택해 주세요.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const nextState = await window.todoApi.add(title, dueAt.toISOString());
      setState(nextState);
      setDraft({ title: "", duePicker: "" });
      setIsAddOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Todo를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function updateTodo(id: string, patch: Partial<Todo>): Promise<void> {
    setState(await window.todoApi.update(id, patch));
  }

  async function deleteTodo(id: string): Promise<void> {
    setState(await window.todoApi.delete(id));
  }

  function startEdit(todo: Todo): void {
    setEditId(todo.id);
    setEditDraft({
      title: todo.title,
      duePicker: toDateTimeLocal(new Date(todo.dueAt))
    });
  }

  async function saveEdit(todo: Todo): Promise<void> {
    const dueAt = getDueFromDraft(editDraft);
    const title = editDraft.title.trim();

    if (!title || !dueAt) {
      return;
    }

    await updateTodo(todo.id, {
      title,
      dueAt: dueAt.toISOString()
    });
    setEditId(null);
  }

  async function updateReminder(minutes: number): Promise<void> {
    const nextState = await window.todoApi.updateSettings({ reminderLeadMinutes: minutes });
    setState(nextState);
    setCustomReminder(String(nextState.settings.reminderLeadMinutes));
  }

  return (
    <main className="app-shell">
      <header className="titlebar">
        <div className="drag-region" aria-label="위젯 이동 영역" />
        <div className="window-actions">
          <button aria-label="Todo 추가" type="button" onClick={() => setIsAddOpen(true)}>
            <Plus size={16} />
          </button>
          <button aria-label="창 최소화" type="button" onClick={() => void window.windowApi.minimize()}>
            <Minus size={15} />
          </button>
          <button aria-label="창 닫기" type="button" onClick={() => void window.windowApi.close()}>
            <X size={15} />
          </button>
        </div>
      </header>

      <section className="calendar-band">
        <img ref={catRef} className={`widget-cat ${isThrowing ? "hidden-during-throw" : ""}`} src={catIdleDataUrl} alt="고양이" />
        <div className="calendar-copy">
          <div>
            <strong>다가오는 todo</strong>
            <span>{activeTodos.length ? `${activeTodos.length}개 대기 중` : "기한 있는 블럭을 추가해 보세요"}</span>
          </div>
        </div>
      </section>

      <section className="todo-list" aria-label="Todo 목록">
        {activeTodos.length === 0 && completedTodos.length === 0 && (
          <div className="empty-state">
            <Bell size={22} />
            <span>아직 todo가 없습니다.</span>
          </div>
        )}

        {activeTodos.map((todo) => (
          <TodoBlock
            key={todo.id}
            todo={todo}
            editing={editId === todo.id}
            editDraft={editDraft}
            setEditDraft={setEditDraft}
            onEdit={() => startEdit(todo)}
            onSave={() => void saveEdit(todo)}
            onCancel={() => setEditId(null)}
            onToggle={() => void updateTodo(todo.id, { completed: !todo.completed })}
            onDelete={() => void deleteTodo(todo.id)}
          />
        ))}

        {completedTodos.length > 0 && <h2 className="completed-heading">완료됨</h2>}
        {completedTodos.map((todo) => (
          <TodoBlock
            key={todo.id}
            todo={todo}
            editing={editId === todo.id}
            editDraft={editDraft}
            setEditDraft={setEditDraft}
            onEdit={() => startEdit(todo)}
            onSave={() => void saveEdit(todo)}
            onCancel={() => setEditId(null)}
            onToggle={() => void updateTodo(todo.id, { completed: !todo.completed })}
            onDelete={() => void deleteTodo(todo.id)}
          />
        ))}
      </section>

      {isAddOpen && (
        <div className="modal-stage" role="presentation">
          <form className="todo-modal" onSubmit={(event) => void submitTodo(event)}>
            <div className="modal-header">
              <strong>Todo 추가</strong>
              <button
                aria-label="Todo 추가 닫기"
                type="button"
                onClick={() => {
                  setIsAddOpen(false);
                  setError("");
                }}
              >
                <X size={16} />
              </button>
            </div>

            <label>
              <span>제목</span>
              <input
                autoFocus
                value={draft.title}
                placeholder="예: 회의 자료 정리"
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </label>

            <label>
              <span>기한 날짜</span>
              <input
                type="datetime-local"
                value={draft.duePicker}
                onChange={(event) => setDraft((current) => ({ ...current, duePicker: event.target.value }))}
              />
            </label>

            {error && <p className="form-error">{error}</p>}

            <section className="modal-settings" aria-label="임박 알림 설정">
              <div className="settings-label">
                <Settings size={16} />
                <span>임박 알림</span>
              </div>
              <div className="preset-group">
                {reminderPresets.map((minutes) => (
                  <button
                    className={state.settings.reminderLeadMinutes === minutes ? "selected" : ""}
                    type="button"
                    key={minutes}
                    onClick={() => void updateReminder(minutes)}
                  >
                    {minutes}분
                  </button>
                ))}
              </div>
              <div className="custom-reminder">
                <input
                  aria-label="직접 알림 분 입력"
                  inputMode="numeric"
                  value={customReminder}
                  onChange={(event) => setCustomReminder(event.target.value.replace(/\D/g, ""))}
                />
                <button
                  aria-label="직접 알림 분 저장"
                  type="button"
                  onClick={() => void updateReminder(Number(customReminder))}
                >
                  <Save size={15} />
                </button>
              </div>
            </section>

            <button className="primary-action" type="submit" disabled={busy}>
              <Plus size={18} />
              <span>추가</span>
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

interface TodoBlockProps {
  todo: Todo;
  editing: boolean;
  editDraft: Draft;
  setEditDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function TodoBlock({
  todo,
  editing,
  editDraft,
  setEditDraft,
  onEdit,
  onSave,
  onCancel,
  onToggle,
  onDelete
}: TodoBlockProps): React.ReactElement {
  const overdue = !todo.completed && new Date(todo.dueAt).getTime() < Date.now();

  return (
    <article className={`todo-block ${todo.completed ? "done" : ""} ${overdue ? "overdue" : ""}`}>
      <button className="complete-button" aria-label="완료 전환" type="button" onClick={onToggle}>
        {todo.completed ? <CheckCircle2 size={18} /> : <Check size={18} />}
      </button>

      <div className="todo-content">
        {editing ? (
          <div className="edit-fields">
            <input
              value={editDraft.title}
              onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))}
            />
            <input
              type="datetime-local"
              value={editDraft.duePicker}
              onChange={(event) => setEditDraft((current) => ({ ...current, duePicker: event.target.value }))}
            />
          </div>
        ) : (
          <>
            <strong>{todo.title}</strong>
            <div className="todo-meta">
              <Clock size={14} />
              <span>{toReadableDate(todo.dueAt)}</span>
              <small>{formatRemaining(todo.dueAt)}</small>
            </div>
          </>
        )}
      </div>

      <div className="todo-actions">
        {editing ? (
          <>
            <button aria-label="수정 저장" type="button" onClick={onSave}>
              <Save size={16} />
            </button>
            <button aria-label="수정 취소" type="button" onClick={onCancel}>
              <X size={16} />
            </button>
          </>
        ) : (
          <>
            <button aria-label="수정" type="button" onClick={onEdit}>
              <Edit3 size={16} />
            </button>
            <button aria-label="삭제" type="button" onClick={onDelete}>
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export default App;
