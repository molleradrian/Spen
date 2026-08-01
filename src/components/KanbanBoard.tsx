import React, { useState } from 'react';
import { 
  Plus, 
  CheckCircle2, 
  Clock, 
  CircleDashed, 
  ChevronRight, 
  FileText, 
  Briefcase, 
  FolderPlus,
  Trash2,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Layers
} from 'lucide-react';
import { Client, Project, TaskItem, TaskFile } from '../types';

interface KanbanBoardProps {
  clients: Client[];
  projects: Project[];
  tasks: TaskItem[];
  taskFiles: TaskFile[];
  selectedClientId: string;
  selectedProjectId: string;
  activeTaskId: string | null;
  onSelectClient: (clientId: string) => void;
  onSelectProject: (projectId: string) => void;
  onSelectTask: (task: TaskItem) => void;
  onCreateTask: (taskName: string) => void;
  onUpdateTaskStatus: (taskId: string, status: 'To Do' | 'In Progress' | 'Done') => void;
  onDeleteTask: (taskId: string) => void;
  onOpenNewClientModal: () => void;
  onOpenNewProjectModal: () => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  clients,
  projects,
  tasks,
  taskFiles,
  selectedClientId,
  selectedProjectId,
  activeTaskId,
  onSelectClient,
  onSelectProject,
  onSelectTask,
  onCreateTask,
  onUpdateTaskStatus,
  onDeleteTask,
  onOpenNewClientModal,
  onOpenNewProjectModal
}) => {
  const [newTaskName, setNewTaskName] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isBriefExpanded, setIsBriefExpanded] = useState(true);

  // Active project & client lookup
  const currentProject = projects.find(p => p.id === selectedProjectId);
  const currentClient = clients.find(c => c.id === selectedClientId);

  // Filter tasks by selected project
  const filteredTasks = selectedProjectId
    ? tasks.filter(t => t.ownerProjectID === selectedProjectId)
    : tasks;

  const todoTasks = filteredTasks.filter(t => t.status === 'To Do');
  const inProgressTasks = filteredTasks.filter(t => t.status === 'In Progress');
  const doneTasks = filteredTasks.filter(t => t.status === 'Done');

  const handleCreateTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    onCreateTask(newTaskName.trim());
    setNewTaskName('');
    setIsAddingTask(false);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#080A12] border-r border-white/10 overflow-hidden select-none">
      {/* Top Banner: Project Context & Brief */}
      <div className="p-3.5 border-b border-white/10 bg-zinc-950/60 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#007aff] animate-pulse" />
            <h2 className="text-xs font-black uppercase tracking-wider text-zinc-200">
              ZIGN KANBAN STUDIO
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenNewClientModal}
              className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-bold text-zinc-300 rounded border border-white/10 transition-colors"
            >
              + Client
            </button>
            <button
              onClick={onOpenNewProjectModal}
              className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-bold text-zinc-300 rounded border border-white/10 transition-colors"
            >
              + Project
            </button>
          </div>
        </div>

        {/* Active Project & Brief Card */}
        {currentProject && (
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] font-mono uppercase text-emerald-400 font-bold block">
                  {currentClient?.companyName || 'Project Brief'}
                </span>
                <h3 className="text-xs font-bold text-white tracking-wide">
                  {currentProject.projectName}
                </h3>
              </div>
              <button 
                onClick={() => setIsBriefExpanded(!isBriefExpanded)}
                className="text-zinc-500 hover:text-white text-[10px] uppercase font-mono flex items-center gap-1"
              >
                <span>{isBriefExpanded ? 'Hide' : 'Brief'}</span>
                <ChevronDown size={12} className={`transition-transform ${isBriefExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {isBriefExpanded && currentProject.brief && (
              <p className="text-[10px] text-zinc-400 font-sans leading-relaxed line-clamp-3 bg-zinc-950/40 p-2 rounded-lg border border-white/5">
                {currentProject.brief}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Kanban Board Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 font-mono text-xs">
        {/* Quick Add Task Button */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
            Tasks ({filteredTasks.length})
          </span>
          <button
            onClick={() => setIsAddingTask(!isAddingTask)}
            className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-[#00E5CC] hover:underline"
          >
            <Plus size={12} />
            <span>Add Task</span>
          </button>
        </div>

        {isAddingTask && (
          <form onSubmit={handleCreateTaskSubmit} className="p-2 bg-zinc-950 rounded-xl border border-[#007aff]/40 space-y-2">
            <input
              type="text"
              autoFocus
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Enter task title..."
              className="w-full bg-zinc-900 text-xs text-white px-2.5 py-1.5 rounded-lg border border-white/10 focus:outline-none focus:border-[#007aff]"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsAddingTask(false)}
                className="px-2 py-1 text-[10px] text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-[#007aff] hover:bg-[#007aff]/80 text-white text-[10px] font-bold uppercase rounded-lg"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {/* 3 KANBAN COLUMNS */}
        <div className="space-y-4">
          {/* COLUMN 1: TO DO */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2 py-1 bg-purple-950/30 border border-purple-500/20 rounded-lg">
              <div className="flex items-center gap-1.5 text-purple-300">
                <CircleDashed size={12} />
                <span className="text-[10px] font-extrabold uppercase tracking-wider">To Do</span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-purple-900/60 rounded text-purple-200">
                {todoTasks.length}
              </span>
            </div>

            {todoTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                isActive={task.id === activeTaskId}
                files={taskFiles.filter(f => f.ownerTaskID === task.id)}
                onSelect={() => onSelectTask(task)}
                onMoveStatus={(s) => onUpdateTaskStatus(task.id, s)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
            {todoTasks.length === 0 && (
              <div className="text-[10px] text-zinc-600 text-center py-2 italic">No tasks in To Do</div>
            )}
          </div>

          {/* COLUMN 2: IN PROGRESS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2 py-1 bg-amber-950/30 border border-amber-500/20 rounded-lg">
              <div className="flex items-center gap-1.5 text-amber-300">
                <Clock size={12} />
                <span className="text-[10px] font-extrabold uppercase tracking-wider">In Progress</span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-900/60 rounded text-amber-200">
                {inProgressTasks.length}
              </span>
            </div>

            {inProgressTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                isActive={task.id === activeTaskId}
                files={taskFiles.filter(f => f.ownerTaskID === task.id)}
                onSelect={() => onSelectTask(task)}
                onMoveStatus={(s) => onUpdateTaskStatus(task.id, s)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
            {inProgressTasks.length === 0 && (
              <div className="text-[10px] text-zinc-600 text-center py-2 italic">No active tasks</div>
            )}
          </div>

          {/* COLUMN 3: DONE */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-2 py-1 bg-emerald-950/30 border border-emerald-500/20 rounded-lg">
              <div className="flex items-center gap-1.5 text-emerald-300">
                <CheckCircle2 size={12} />
                <span className="text-[10px] font-extrabold uppercase tracking-wider">Done</span>
              </div>
              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-900/60 rounded text-emerald-200">
                {doneTasks.length}
              </span>
            </div>

            {doneTasks.map(task => (
              <TaskCard 
                key={task.id} 
                task={task} 
                isActive={task.id === activeTaskId}
                files={taskFiles.filter(f => f.ownerTaskID === task.id)}
                onSelect={() => onSelectTask(task)}
                onMoveStatus={(s) => onUpdateTaskStatus(task.id, s)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
            {doneTasks.length === 0 && (
              <div className="text-[10px] text-zinc-600 text-center py-2 italic">No completed tasks</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Subcomponent: Individual Task Card
interface TaskCardProps {
  task: TaskItem;
  isActive: boolean;
  files: TaskFile[];
  onSelect: () => void;
  onMoveStatus: (status: 'To Do' | 'In Progress' | 'Done') => void;
  onDelete: () => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isActive,
  files,
  onSelect,
  onMoveStatus,
  onDelete
}) => {
  return (
    <div 
      onClick={onSelect}
      className={`p-3 rounded-xl border transition-all cursor-pointer select-none space-y-2 relative group ${
        isActive 
          ? 'bg-[#610061]/30 border-[#00E5CC] shadow-[0_0_15px_rgba(0,229,204,0.25)]' 
          : 'bg-zinc-950/80 border-white/10 hover:border-white/20 hover:bg-zinc-900/80'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <h4 className={`text-xs font-bold leading-snug ${isActive ? 'text-white font-extrabold' : 'text-zinc-200'}`}>
          {task.taskName}
        </h4>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete task "${task.taskName}"?`)) onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 p-0.5 transition-opacity"
          title="Delete task"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {files.length > 0 && (
        <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 bg-white/5 px-2 py-1 rounded">
          <Layers size={10} className="text-[#00E5CC]" />
          <span>{files.length} artwork attachment{files.length > 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Task Status Quick Switcher */}
      <div className="flex items-center justify-between pt-1 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
        <span className="text-[8.5px] text-zinc-500 uppercase font-mono">
          {isActive ? '● ACTIVE CANVAS' : 'Click to load'}
        </span>
        <div className="flex items-center gap-1">
          {task.status !== 'To Do' && (
            <button
              onClick={() => onMoveStatus('To Do')}
              className="text-[8px] px-1.5 py-0.5 bg-zinc-800 hover:bg-purple-900 text-zinc-300 hover:text-purple-200 rounded font-bold uppercase"
              title="Move to To Do"
            >
              To Do
            </button>
          )}
          {task.status !== 'In Progress' && (
            <button
              onClick={() => onMoveStatus('In Progress')}
              className="text-[8px] px-1.5 py-0.5 bg-zinc-800 hover:bg-amber-900 text-zinc-300 hover:text-amber-200 rounded font-bold uppercase"
              title="Move to In Progress"
            >
              Start
            </button>
          )}
          {task.status !== 'Done' && (
            <button
              onClick={() => onMoveStatus('Done')}
              className="text-[8px] px-1.5 py-0.5 bg-zinc-800 hover:bg-emerald-900 text-zinc-300 hover:text-emerald-200 rounded font-bold uppercase"
              title="Move to Done"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
