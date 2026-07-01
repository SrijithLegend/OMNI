/**
 * Tasks — Task management UI components with Kanban and List views.
 */

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { CircleCheck as CheckCircle2, Circle, Clock, Star, Pin, MoveVertical as MoreVertical, Plus, Trash2, Calendar, Flag, Search, LayoutGrid, List, GripVertical, CircleAlert as AlertCircle, ChevronDown, ChevronRight, CreditCard as Edit3, X, Loader as Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UUID } from "@/types/omni";
import type { Task, TaskStatus, TaskPriority, TaskStats, Folder } from "@/models/workspace";
import { getTaskStatusColor, getTaskPriorityColor } from "@/models/workspace";

// ============== TASK PRIORITY ICON ==============

interface TaskPriorityIconProps {
  priority: TaskPriority;
  className?: string;
}

export function TaskPriorityIcon({ priority, className }: TaskPriorityIconProps) {
  const colors: Record<TaskPriority, string> = {
    low: "text-slate-400",
    medium: "text-blue-500",
    high: "text-orange-500",
    urgent: "text-red-500",
  };

  return <Flag className={cn(colors[priority], className)} size={14} />;
}

// ============== TASK CARD COMPONENT ==============

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  onComplete?: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  onEdit?: () => void;
  selected?: boolean;
  viewMode?: "kanban" | "list";
  draggable?: boolean;
}

export function TaskCard({
  task,
  onClick,
  onComplete,
  onDelete,
  onToggleFavorite,
  onEdit,
  selected = false,
  viewMode = "kanban",
  draggable = false,
}: TaskCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    if (taskDate.getTime() === today.getTime()) return "Today";
    if (taskDate.getTime() === tomorrow.getTime()) return "Tomorrow";

    const diffDays = Math.floor((taskDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays <= 7) return `${diffDays}d`;

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";

  const statusIcon = task.status === "done"
    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
    : <Circle className="w-5 h-5 text-muted-foreground" />;

  const renderCardContent = () => (
    <>
      {/* Title */}
      <div className="flex items-start gap-2 mb-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete?.();
          }}
          className="mt-0.5"
        >
          {statusIcon}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium text-sm truncate",
              task.status === "done" && "line-through text-muted-foreground"
            )}>
              {task.title}
            </span>
            {task.isFavorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
            {task.isPinned && <Pin className="w-3 h-3 text-blue-500 flex-shrink-0" />}
          </div>

          {viewMode === "kanban" && task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {task.description}
            </p>
          )}
        </div>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded hover:bg-muted/50"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute right-0 top-6 z-10 w-36 bg-background border rounded-lg shadow-lg overflow-hidden"
              >
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onEdit();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" /> Edit
                  </button>
                )}
                {onToggleFavorite && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onToggleFavorite();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                  >
                    <Star className="w-4 h-4" /> {task.isFavorite ? "Unfavorite" : "Favorite"}
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-red-500"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <TaskPriorityIcon priority={task.priority} />

        {task.dueDate && (
          <span className={cn(
            "flex items-center gap-1",
            isOverdue && "text-red-500"
          )}>
            <Calendar className="w-3 h-3" />
            {formatDate(task.dueDate)}
          </span>
        )}

        {task.progress > 0 && task.progress < 100 && (
          <span>{task.progress}%</span>
        )}

        {task.tags.length > 0 && (
          <div className="flex gap-1">
            {task.tags.slice(0, 2).map((tag, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 bg-muted rounded text-xs"
              >
                {tag}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-xs">+{task.tags.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </>
  );

  if (viewMode === "list") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border bg-background transition-colors",
          "hover:bg-muted/10",
          selected && "bg-primary/10 border-primary"
        )}
        onClick={onClick}
      >
        {draggable && (
          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
        )}
        <div className="flex-1">{renderCardContent()}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative p-3 rounded-lg border bg-background transition-all cursor-pointer",
        "hover:shadow-sm hover:border-primary/20",
        selected && "bg-primary/10 border-primary",
        task.status === "done" && "opacity-60"
      )}
      onClick={onClick}
    >
      {draggable && (
        <GripVertical className="absolute top-2 left-2 w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
      )}
      <div className={draggable ? "ml-5" : ""}>{renderCardContent()}</div>
    </div>
  );
}

// ============== KANBAN COLUMN COMPONENT ==============

interface KanbanColumnProps {
  title: string;
  status: TaskStatus;
  tasks: Task[];
  color: string;
  onTaskClick?: (task: Task) => void;
  onTaskComplete?: (task: Task) => void;
  onTaskDelete?: (task: Task) => void;
  onTaskFavorite?: (task: Task) => void;
  onTaskEdit?: (task: Task) => void;
  onTaskMove?: (taskId: UUID, newStatus: TaskStatus, newPosition: number) => void;
  onTaskDrop?: (taskId: UUID, targetStatus: TaskStatus) => void;
  onAddTask?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function KanbanColumn({
  title,
  status,
  tasks,
  color,
  onTaskClick,
  onTaskComplete,
  onTaskDelete,
  onTaskFavorite,
  onTaskEdit,
  onTaskMove,
  onTaskDrop,
  onAddTask,
  collapsed = false,
  onToggleCollapse,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<UUID | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId") as UUID;
    if (taskId && onTaskDrop) {
      onTaskDrop(taskId, status);
    }
    setIsDragOver(false);
    setDragOverIndex(null);
  };

  const handleDragStart = (e: React.DragEvent, taskId: UUID) => {
    e.dataTransfer.setData("taskId", taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setIsDragOver(false);
    setDragOverIndex(null);
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full min-w-[280px] max-w-[320px] rounded-lg",
        isDragOver && "bg-primary/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 mb-2">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-2 font-medium text-sm"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
          <span className={cn("w-2 h-2 rounded-full", `bg-${color}-500`)} />
          <span>{title}</span>
          <span className="text-muted-foreground">{tasks.length}</span>
        </button>

        {onAddTask && (
          <button
            onClick={onAddTask}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tasks */}
      {!collapsed && (
        <div className="flex-1 overflow-auto space-y-2 pb-4">
          <AnimatePresence mode="popLayout">
            {tasks.map((task, index) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverIndex(index);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedTaskId = e.dataTransfer.getData("taskId") as UUID;
                  if (droppedTaskId && onTaskMove) {
                    onTaskMove(droppedTaskId, status, index);
                  }
                }}
              >
                <TaskCard
                  task={task}
                  viewMode="kanban"
                  onClick={() => onTaskClick?.(task)}
                  onComplete={() => onTaskComplete?.(task)}
                  onDelete={() => onTaskDelete?.(task)}
                  onToggleFavorite={() => onTaskFavorite?.(task)}
                  onEdit={() => onTaskEdit?.(task)}
                  draggable
                />
              </div>
            ))}
          </AnimatePresence>

          {/* Drop zone indicator at end */}
          {isDragOver && dragOverIndex === null && (
            <div className="h-16 border-2 border-dashed border-primary/50 rounded-lg" />
          )}
        </div>
      )}
    </div>
  );
}

// ============== KANBAN BOARD COMPONENT ==============

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onTaskComplete?: (task: Task) => void;
  onTaskDelete?: (task: Task) => void;
  onTaskFavorite?: (task: Task) => void;
  onTaskEdit?: (task: Task) => void;
  onTaskMove?: (taskId: UUID, newStatus: TaskStatus, newPosition: number) => void;
  onAddTask?: (status: TaskStatus) => void;
  className?: string;
}

export function KanbanBoard({
  tasks,
  onTaskClick,
  onTaskComplete,
  onTaskDelete,
  onTaskFavorite,
  onTaskEdit,
  onTaskMove,
  onAddTask,
  className,
}: KanbanBoardProps) {
  const [collapsedColumns, setCollapsedColumns] = useState<Set<TaskStatus>>(new Set());

  const columns: { status: TaskStatus; title: string; color: string }[] = [
    { status: "todo", title: "To Do", color: "gray" },
    { status: "in_progress", title: "In Progress", color: "blue" },
    { status: "review", title: "Review", color: "yellow" },
    { status: "done", title: "Done", color: "green" },
  ];

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      review: [],
      done: [],
      archived: [],
    };

    for (const task of tasks) {
      if (map[task.status]) {
        map[task.status].push(task);
      }
    }

    // Sort each column by position
    for (const status of Object.keys(map)) {
      map[status as TaskStatus].sort((a, b) => a.position - b.position);
    }

    return map;
  }, [tasks]);

  const toggleColumn = (status: TaskStatus) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  return (
    <div className={cn("flex gap-4 h-full overflow-x-auto pb-4", className)}>
      {columns.map(({ status, title, color }) => (
        <KanbanColumn
          key={status}
          title={title}
          status={status}
          tasks={tasksByStatus[status]}
          color={color}
          onTaskClick={onTaskClick}
          onTaskComplete={onTaskComplete}
          onTaskDelete={onTaskDelete}
          onTaskFavorite={onTaskFavorite}
          onTaskEdit={onTaskEdit}
          onTaskMove={onTaskMove}
          onTaskDrop={(taskId, targetStatus) => onTaskMove?.(taskId, targetStatus, tasksByStatus[targetStatus].length)}
          onAddTask={() => onAddTask?.(status)}
          collapsed={collapsedColumns.has(status)}
          onToggleCollapse={() => toggleColumn(status)}
        />
      ))}
    </div>
  );
}

// ============== TASK STATS BAR ==============

interface TaskStatsBarProps {
  stats: TaskStats;
  className?: string;
}

export function TaskStatsBar({ stats, className }: TaskStatsBarProps) {
  const completionRate = stats.total > 0
    ? Math.round((stats.done / stats.total) * 100)
    : 0;

  return (
    <div className={cn("grid grid-cols-4 gap-3", className)}>
      <div className="p-3 rounded-lg bg-muted/30 text-center">
        <div className="text-2xl font-bold">{stats.total}</div>
        <div className="text-xs text-muted-foreground">Total</div>
      </div>
      <div className="p-3 rounded-lg bg-muted/30 text-center">
        <div className="text-2xl font-bold text-blue-500">{stats.inProgress}</div>
        <div className="text-xs text-muted-foreground">In Progress</div>
      </div>
      <div className="p-3 rounded-lg bg-muted/30 text-center">
        <div className="text-2xl font-bold text-green-500">{completionRate}%</div>
        <div className="text-xs text-muted-foreground">Complete</div>
      </div>
      <div className="p-3 rounded-lg bg-muted/30 text-center">
        <div className="text-2xl font-bold text-red-500">{stats.overdue}</div>
        <div className="text-xs text-muted-foreground">Overdue</div>
      </div>
    </div>
  );
}

// ============== TASK LIST COMPONENT ==============

interface TaskListProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
  onTaskComplete?: (task: Task) => void;
  onTaskDelete?: (task: Task) => void;
  onTaskFavorite?: (task: Task) => void;
  onTaskEdit?: (task: Task) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function TaskList({
  tasks,
  onTaskClick,
  onTaskComplete,
  onTaskDelete,
  onTaskFavorite,
  onTaskEdit,
  loading = false,
  emptyMessage = "No tasks",
  className,
}: TaskListProps) {
  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse h-16 rounded-lg bg-muted/30" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className={cn("text-center py-12", className)}>
        <Circle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <AnimatePresence mode="popLayout">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            viewMode="list"
            onClick={() => onTaskClick?.(task)}
            onComplete={() => onTaskComplete?.(task)}
            onDelete={() => onTaskDelete?.(task)}
            onToggleFavorite={() => onTaskFavorite?.(task)}
            onEdit={() => onTaskEdit?.(task)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============== TASKS TAB COMPONENT ==============

interface TasksTabProps {
  projectId: UUID;
  tasks: Task[];
  stats: TaskStats;
  onCreateTask: (title: string, status: TaskStatus) => void;
  onUpdateTask: (taskId: UUID, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: UUID) => void;
  onMoveTask: (taskId: UUID, newStatus: TaskStatus, newPosition: number) => void;
  loading?: boolean;
  defaultView?: "kanban" | "list";
  className?: string;
}

export function TasksTab({
  projectId: _projectId,
  tasks,
  stats,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onMoveTask,
  loading = false,
  defaultView = "kanban",
  className,
}: TasksTabProps) {
  const [viewMode, setViewMode] = useState<"kanban" | "list">(defaultView);
  const [searchQuery, setSearchQuery] = useState("");
  const [showStats, setShowStats] = useState(true);

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;

    const query = searchQuery.toLowerCase();
    return tasks.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }, [tasks, searchQuery]);

  const handleTaskComplete = (task: Task) => {
    if (task.status === "done") {
      onUpdateTask(task.id, { status: "todo", completedAt: null, progress: 0 });
    } else {
      onUpdateTask(task.id, { status: "done", completedAt: Date.now(), progress: 100 });
    }
  };

  const handleTaskFavorite = (task: Task) => {
    onUpdateTask(task.id, { isFavorite: !task.isFavorite });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm"
            />
          </div>

          <div className="flex items-center gap-1 border rounded-lg p-1">
            <button
              onClick={() => setViewMode("kanban")}
              className={cn(
                "p-2 rounded transition-colors",
                viewMode === "kanban" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-2 rounded transition-colors",
                viewMode === "list" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        <button
          onClick={() => onCreateTask("New Task", "todo")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* Stats */}
      {showStats && <TaskStatsBar stats={stats} />}

      {/* View */}
      {viewMode === "kanban" ? (
        <KanbanBoard
          tasks={filteredTasks}
          onTaskComplete={handleTaskComplete}
          onTaskDelete={(task) => onDeleteTask(task.id)}
          onTaskFavorite={handleTaskFavorite}
          onTaskMove={onMoveTask}
          onAddTask={(status) => onCreateTask("New Task", status)}
        />
      ) : (
        <TaskList
          tasks={filteredTasks}
          onTaskComplete={handleTaskComplete}
          onTaskDelete={(task) => onDeleteTask(task.id)}
          onTaskFavorite={handleTaskFavorite}
          loading={loading}
        />
      )}
    </div>
  );
}
