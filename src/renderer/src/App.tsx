import {
  Archive,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Minus,
  Palette,
  Pause,
  Play,
  Plus,
  Save,
  Settings,
  Trash2,
  X
} from "lucide-react";
import { FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppState, CatAssets, CatVariant, Todo } from "../../shared/types";
import { fallbackCatAssets } from "../../shared/catAssets";
import { findAlertableTodo, sortTodos } from "./todoLogic";

const reminderPresets = [5, 10, 30, 60];
const progressPaneStorageKey = "cat-plan-progress-pane-height";
const minimumProgressPaneHeight = 104;
const minimumWaitingPaneHeight = 96;
const todoBoardBottomPadding = 12;
const catOptions: Array<{ value: CatVariant; label: string }> = [
  { value: "cat01", label: "01" },
  { value: "cat02", label: "02" },
  { value: "cat03", label: "03" },
  { value: "cat04", label: "04" },
  { value: "cat05", label: "05" }
];
const defaultState: AppState = {
  todos: [],
  settings: {
    reminderLeadMinutes: 10,
    catVariant: "cat05"
  }
};

interface Draft {
  title: string;
  memo: string;
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

function formatRemaining(dueAt: string, now: number): string {
  const diff = new Date(dueAt).getTime() - now;
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

function readStoredProgressPaneHeight(): number | null {
  const stored = window.localStorage.getItem(progressPaneStorageKey);
  const parsed = Number(stored);
  return Number.isFinite(parsed) && parsed >= minimumProgressPaneHeight ? Math.round(parsed) : null;
}

function App(): React.ReactElement {
  const catRef = useRef<HTMLImageElement>(null);
  const todoBoardRef = useRef<HTMLElement>(null);
  const throwTimerRef = useRef<number | undefined>(undefined);
  const [state, setState] = useState<AppState>(defaultState);
  const [draft, setDraft] = useState<Draft>({ title: "", memo: "", duePicker: "" });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>({ title: "", memo: "", duePicker: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [customReminder, setCustomReminder] = useState("10");
  const [alertTodo, setAlertTodo] = useState<AlertTodo | null>(null);
  const [isThrowing, setIsThrowing] = useState(false);
  const [catAssets, setCatAssets] = useState<CatAssets>(fallbackCatAssets);
  const [progressPaneHeight, setProgressPaneHeight] = useState<number | null>(readStoredProgressPaneHeight);
  const [isResizingProgress, setIsResizingProgress] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const sortedTodos = useMemo(() => sortTodos(state.todos), [state.todos]);
  const activeTodos = sortedTodos.filter((todo) => !todo.completed);
  const waitingTodos = activeTodos.filter((todo) => todo.status !== "inProgress");
  const inProgressTodos = activeTodos.filter((todo) => todo.status === "inProgress");
  const completedTodos = sortedTodos.filter((todo) => todo.completed);

  const clampProgressPaneHeight = useCallback((height: number): number => {
    const boardHeight = todoBoardRef.current?.getBoundingClientRect().height ?? 0;
    const maximumProgressPaneHeight = boardHeight
      ? Math.max(minimumProgressPaneHeight, boardHeight - minimumWaitingPaneHeight)
      : 320;

    return Math.round(Math.min(maximumProgressPaneHeight, Math.max(minimumProgressPaneHeight, height)));
  }, []);

  const applyProgressPaneHeight = useCallback((height: number): void => {
    const nextHeight = clampProgressPaneHeight(height);
    setProgressPaneHeight(nextHeight);
    window.localStorage.setItem(progressPaneStorageKey, String(nextHeight));
  }, [clampProgressPaneHeight]);

  function getProgressHeightFromPointer(clientY: number): number | null {
    const boardBounds = todoBoardRef.current?.getBoundingClientRect();
    if (!boardBounds) {
      return null;
    }

    return boardBounds.bottom - clientY - todoBoardBottomPadding;
  }

  function beginProgressResize(event: ReactPointerEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsResizingProgress(true);

    const updateFromPointer = (clientY: number): void => {
      const nextHeight = getProgressHeightFromPointer(clientY);
      if (nextHeight !== null) {
        applyProgressPaneHeight(nextHeight);
      }
    };

    updateFromPointer(event.clientY);

    const handlePointerMove = (moveEvent: PointerEvent): void => {
      moveEvent.preventDefault();
      updateFromPointer(moveEvent.clientY);
    };

    const handlePointerUp = (): void => {
      setIsResizingProgress(false);
      window.removeEventListener("pointermove", handlePointerMove);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function adjustProgressPaneHeight(event: KeyboardEvent<HTMLDivElement>): void {
    const currentHeight = progressPaneHeight ?? 150;

    if (event.key === "ArrowUp") {
      event.preventDefault();
      applyProgressPaneHeight(currentHeight + 24);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      applyProgressPaneHeight(currentHeight - 24);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      applyProgressPaneHeight(minimumProgressPaneHeight);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      applyProgressPaneHeight(Number.MAX_SAFE_INTEGER);
    }
  }

  function restoreWidgetCat(): void {
    setIsThrowing(false);
    if (throwTimerRef.current !== undefined) {
      window.clearTimeout(throwTimerRef.current);
      throwTimerRef.current = undefined;
    }
  }

  useEffect(() => {
    const syncTime = (): void => setCurrentTime(Date.now());
    const timer = window.setInterval(syncTime, 15_000);

    window.addEventListener("focus", syncTime);
    document.addEventListener("visibilitychange", syncTime);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", syncTime);
      document.removeEventListener("visibilitychange", syncTime);
    };
  }, []);

  useEffect(() => {
    if (progressPaneHeight === null || inProgressTodos.length === 0) {
      return undefined;
    }

    const syncProgressPaneHeight = (): void => {
      setProgressPaneHeight((currentHeight) => {
        if (currentHeight === null) {
          return currentHeight;
        }

        const nextHeight = clampProgressPaneHeight(currentHeight);
        if (nextHeight !== currentHeight) {
          window.localStorage.setItem(progressPaneStorageKey, String(nextHeight));
        }

        return nextHeight;
      });
    };

    syncProgressPaneHeight();
    window.addEventListener("resize", syncProgressPaneHeight);
    return () => window.removeEventListener("resize", syncProgressPaneHeight);
  }, [clampProgressPaneHeight, inProgressTodos.length, progressPaneHeight]);

  useEffect(() => {
    void window.todoApi.load().then((loaded) => {
      setState(loaded);
      setCustomReminder(String(loaded.settings.reminderLeadMinutes));
      void window.assetApi.getCatAssets(loaded.settings.catVariant).then(setCatAssets);
    });

    const unsubscribeAlertClosed = window.windowApi.onAlertClosed(restoreWidgetCat);
    const unsubscribeMenuCommand = window.windowApi.onMenuCommand((command) => {
      if (command === "open-add") {
        setIsArchiveOpen(false);
        setIsAddOpen(true);
        return;
      }

      setIsAddOpen(false);
      setIsArchiveOpen(true);
    });

    return () => {
      unsubscribeAlertClosed();
      unsubscribeMenuCommand();
      if (throwTimerRef.current !== undefined) {
        window.clearTimeout(throwTimerRef.current);
      }
    };
  }, []);

  const showThrowAlert = useCallback((todo: Pick<Todo, "title" | "dueAt">): void => {
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
      catVariant: state.settings.catVariant,
      catBounds: catBounds
        ? {
            x: catBounds.x,
            y: catBounds.y,
            width: catBounds.width,
            height: catBounds.height
          }
        : undefined
    });
  }, [state.settings.catVariant]);

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
  }, [alertTodo?.todo.id, showThrowAlert, state.settings.reminderLeadMinutes, state.todos]);

  useEffect(() => {
    if (!alertTodo) {
      return undefined;
    }

    const timer = window.setTimeout(() => setAlertTodo(null), 8000);
    return () => window.clearTimeout(timer);
  }, [alertTodo]);

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
      const nextState = await window.todoApi.add(title, dueAt.toISOString(), draft.memo);
      setState(nextState);
      setDraft({ title: "", memo: "", duePicker: "" });
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
      memo: todo.memo ?? "",
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
      memo: editDraft.memo,
      dueAt: dueAt.toISOString()
    });
    setEditId(null);
  }

  async function updateReminder(minutes: number): Promise<void> {
    const nextState = await window.todoApi.updateSettings({ reminderLeadMinutes: minutes });
    setState(nextState);
    setCustomReminder(String(nextState.settings.reminderLeadMinutes));
  }

  async function updateCatVariant(catVariant: CatVariant): Promise<void> {
    const nextState = await window.todoApi.updateSettings({ catVariant });
    setState(nextState);
    setCatAssets(await window.assetApi.getCatAssets(nextState.settings.catVariant));
  }

  return (
    <main className="app-shell">
      <header className="titlebar">
        <div className="drag-region" aria-label="위젯 이동 영역" />
        <div className="window-actions">
          <button aria-label="Todo 추가" type="button" onClick={() => setIsAddOpen(true)}>
            <Plus size={16} />
          </button>
          <button
            aria-label={`보관함 열기, 완료 ${completedTodos.length}개`}
            className="archive-action"
            title="보관함"
            type="button"
            onClick={() => setIsArchiveOpen(true)}
          >
            <Archive size={15} />
            {completedTodos.length > 0 && <span>{completedTodos.length}</span>}
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
        <img ref={catRef} className={`widget-cat ${isThrowing ? "hidden-during-throw" : ""}`} src={catAssets.idle} alt="고양이" />
        <div className="calendar-copy">
          <div>
            <strong>다가오는 todo</strong>
            <span>{activeTodos.length ? `${activeTodos.length}개 대기 중` : "기한 있는 블럭을 추가해 보세요"}</span>
          </div>
        </div>
      </section>

      <section ref={todoBoardRef} className={`todo-board ${isResizingProgress ? "resizing" : ""}`} aria-label="Todo 목록">
        <section className="waiting-pane" aria-label="대기 todo">
          <div className="todo-scroll">
            {waitingTodos.length === 0 && (
              <div className="empty-state">
                <Bell size={22} />
                <span>{inProgressTodos.length ? "대기 todo가 없습니다." : "아직 todo가 없습니다."}</span>
              </div>
            )}

            {waitingTodos.map((todo) => (
              <TodoBlock
                key={todo.id}
                todo={todo}
                now={currentTime}
                editing={editId === todo.id}
                editDraft={editDraft}
                setEditDraft={setEditDraft}
                onEdit={() => startEdit(todo)}
                onSave={() => void saveEdit(todo)}
                onCancel={() => setEditId(null)}
                onToggle={() => void updateTodo(todo.id, { completed: !todo.completed })}
                onProgressToggle={() => void updateTodo(todo.id, { status: "inProgress" })}
                onDelete={() => void deleteTodo(todo.id)}
              />
            ))}
          </div>
        </section>

        {inProgressTodos.length > 0 && (
          <>
            <div
              className="progress-resizer"
              role="separator"
              aria-label="대기 todo와 진행중 영역 높이 조절"
              aria-orientation="horizontal"
              aria-valuemin={minimumProgressPaneHeight}
              aria-valuenow={progressPaneHeight ?? undefined}
              tabIndex={0}
              onKeyDown={adjustProgressPaneHeight}
              onPointerDown={beginProgressResize}
            >
              <span />
            </div>
            <section
              className={`progress-pane ${progressPaneHeight !== null ? "is-resized" : ""}`}
              style={progressPaneHeight !== null ? { height: `${progressPaneHeight}px` } : undefined}
              aria-label="진행중 todo"
            >
              <div className="progress-heading">
                <span>진행중</span>
                <small>{inProgressTodos.length}개</small>
              </div>
              <div className="progress-scroll">
                {inProgressTodos.map((todo) => (
                  <TodoBlock
                    key={todo.id}
                    todo={todo}
                    now={currentTime}
                    editing={editId === todo.id}
                    editDraft={editDraft}
                    setEditDraft={setEditDraft}
                    onEdit={() => startEdit(todo)}
                    onSave={() => void saveEdit(todo)}
                    onCancel={() => setEditId(null)}
                    onToggle={() => void updateTodo(todo.id, { completed: !todo.completed })}
                    onProgressToggle={() => void updateTodo(todo.id, { status: "todo" })}
                    onDelete={() => void deleteTodo(todo.id)}
                  />
                ))}
              </div>
            </section>
          </>
        )}
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
              <span>메모</span>
              <textarea
                value={draft.memo}
                placeholder="필요한 내용을 짧게 적어두세요"
                rows={3}
                onChange={(event) => setDraft((current) => ({ ...current, memo: event.target.value }))}
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
              <div className="settings-label cat-settings-label">
                <Palette size={16} />
                <span>고양이</span>
              </div>
              <div className="cat-picker" role="radiogroup" aria-label="고양이 선택">
                {catOptions.map((option) => (
                  <button
                    key={option.value}
                    aria-checked={state.settings.catVariant === option.value}
                    className={state.settings.catVariant === option.value ? "selected" : ""}
                    role="radio"
                    type="button"
                    onClick={() => void updateCatVariant(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <button className="primary-action" type="submit" disabled={busy}>
              <Plus size={18} />
              <span>추가</span>
            </button>
          </form>
        </div>
      )}

      {isArchiveOpen && (
        <div className="modal-stage" role="presentation">
          <section className="archive-modal" aria-label="완료 todo 보관함">
            <div className="modal-header">
              <strong>보관함</strong>
              <button aria-label="보관함 닫기" type="button" onClick={() => setIsArchiveOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="archive-list">
              {completedTodos.length === 0 ? (
                <div className="empty-state archive-empty">
                  <Archive size={20} />
                  <span>보관된 todo가 없습니다.</span>
                </div>
              ) : (
                completedTodos.map((todo) => (
                  <TodoBlock
                    key={todo.id}
                    todo={todo}
                    now={currentTime}
                    editing={editId === todo.id}
                    editDraft={editDraft}
                    setEditDraft={setEditDraft}
                    onEdit={() => startEdit(todo)}
                    onSave={() => void saveEdit(todo)}
                    onCancel={() => setEditId(null)}
                    onToggle={() => void updateTodo(todo.id, { completed: !todo.completed })}
                    onDelete={() => void deleteTodo(todo.id)}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

interface TodoBlockProps {
  todo: Todo;
  now: number;
  editing: boolean;
  editDraft: Draft;
  setEditDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onToggle: () => void;
  onProgressToggle?: () => void;
  onDelete: () => void;
}

function TodoBlock({
  todo,
  now,
  editing,
  editDraft,
  setEditDraft,
  onEdit,
  onSave,
  onCancel,
  onToggle,
  onProgressToggle,
  onDelete
}: TodoBlockProps): React.ReactElement {
  const overdue = !todo.completed && new Date(todo.dueAt).getTime() < now;
  const inProgress = todo.status === "inProgress";

  return (
    <article className={`todo-block ${todo.completed ? "done" : ""} ${overdue ? "overdue" : ""} ${inProgress ? "in-progress" : ""}`}>
      <button className="complete-button" aria-label="완료 전환" type="button" onClick={onToggle}>
        {todo.completed ? <CheckCircle2 size={18} /> : <Check size={18} />}
      </button>

      <div className="todo-content">
        {editing ? (
          <div className="edit-fields">
            <input
              aria-label="Todo 제목 수정"
              value={editDraft.title}
              onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))}
            />
            <textarea
              aria-label="Todo 메모 수정"
              value={editDraft.memo}
              rows={2}
              onChange={(event) => setEditDraft((current) => ({ ...current, memo: event.target.value }))}
            />
            <input
              aria-label="Todo 기한 수정"
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
              <small>{formatRemaining(todo.dueAt, now)}</small>
            </div>
            {todo.memo && <p className="todo-memo">{todo.memo}</p>}
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
            {onProgressToggle && (
              <button
                aria-label={inProgress ? "진행중 해제" : "진행중으로 이동"}
                title={inProgress ? "대기로 이동" : "진행중"}
                type="button"
                onClick={onProgressToggle}
              >
                {inProgress ? <Pause size={16} /> : <Play size={16} />}
              </button>
            )}
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
