import React from 'react';
import { 
  Sparkles, 
  User as UserIcon, 
  LogOut, 
  Plus, 
  FolderPlus, 
  UserPlus, 
  Layers, 
  Briefcase,
  Grid2X2,
  HardDrive
} from 'lucide-react';
import { User } from 'firebase/auth';
import { Client, Project } from '../types';

interface HeaderBarProps {
  user: User | null;
  clients: Client[];
  projects: Project[];
  selectedClientId: string;
  selectedProjectId: string;
  onSelectClient: (clientId: string) => void;
  onSelectProject: (projectId: string) => void;
  onOpenNewClientModal: () => void;
  onOpenNewProjectModal: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onToggleInspirationModal: () => void;
  onToggleWorkspaceModal?: () => void;
  onToggleDriveModal?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  user,
  clients,
  projects,
  selectedClientId,
  selectedProjectId,
  onSelectClient,
  onSelectProject,
  onOpenNewClientModal,
  onOpenNewProjectModal,
  onSignIn,
  onSignOut,
  onToggleInspirationModal,
  onToggleWorkspaceModal,
  onToggleDriveModal
}) => {
  const filteredProjects = selectedClientId 
    ? projects.filter(p => p.ownerClientID === selectedClientId)
    : projects;

  return (
    <header className="h-16 bg-[#080A12] border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 z-30 select-none">
      {/* Brand & Canon Entropy Emblem */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#610061] via-[#007aff] to-[#617700] p-0.5 flex items-center justify-center shadow-[0_0_12px_rgba(97,0,97,0.5)]">
            <div className="w-full h-full bg-[#080A12] rounded-[10px] flex items-center justify-center font-black text-xs tracking-tighter text-white">
              PZ
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-wider uppercase bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                PENZIGN
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-emerald-400 font-semibold">
                v1.0
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[8.5px] font-mono text-zinc-400">
              <span className="text-[#610061] font-bold">#610061 MAX</span>
              <span>•</span>
              <span className="text-[#ff0000] font-bold">#FF0000 MIN</span>
              <span className="hidden sm:inline">• 68.2% COHERENCE</span>
            </div>
          </div>
        </div>

        {/* Client & Project Switcher Dropdowns */}
        {user && (
          <div className="hidden lg:flex items-center gap-2 ml-4 pl-4 border-l border-white/10">
            {/* Client selector */}
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-white/10 px-2.5 py-1.5 rounded-xl text-xs">
              <Briefcase size={12} className="text-zinc-400 shrink-0" />
              <select
                value={selectedClientId}
                onChange={(e) => onSelectClient(e.target.value)}
                className="bg-transparent text-xs font-semibold focus:outline-none text-zinc-200 cursor-pointer max-w-[130px] truncate"
              >
                <option value="" className="bg-zinc-900 text-zinc-400">All Clients</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                    {c.companyName}
                  </option>
                ))}
              </select>
              <button 
                onClick={onOpenNewClientModal}
                title="Add New Client"
                className="p-0.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>

            {/* Project selector */}
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-white/10 px-2.5 py-1.5 rounded-xl text-xs">
              <FolderPlus size={12} className="text-zinc-400 shrink-0" />
              <select
                value={selectedProjectId}
                onChange={(e) => onSelectProject(e.target.value)}
                className="bg-transparent text-xs font-semibold focus:outline-none text-zinc-200 cursor-pointer max-w-[150px] truncate"
              >
                <option value="" className="bg-zinc-900 text-zinc-400">All Projects</option>
                {filteredProjects.map(p => (
                  <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                    {p.projectName}
                  </option>
                ))}
              </select>
              <button 
                onClick={onOpenNewProjectModal}
                title="Add New Project"
                className="p-0.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons & Auth */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Gemini Inspiration Engine Button */}
        <button
          onClick={onToggleInspirationModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#610061]/80 to-[#007aff]/80 hover:from-[#610061] hover:to-[#007aff] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-[0_0_15px_rgba(97,0,97,0.4)] border border-purple-400/30 transition-all active:scale-95"
        >
          <Sparkles size={14} className="text-amber-300 animate-pulse" />
          <span className="hidden sm:inline">Inspiration Engine</span>
        </button>

        {/* Workspace Hub toggle if available */}
        {onToggleWorkspaceModal && user && (
          <button
            onClick={onToggleWorkspaceModal}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl border border-white/10 transition-colors"
            title="Google Workspace Hub"
          >
            <Grid2X2 size={16} />
          </button>
        )}

        {/* User Auth Info / Actions */}
        {user ? (
          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-zinc-200 max-w-[120px] truncate">
                {user.displayName || user.email?.split('@')[0]}
              </span>
              <span className="text-[9px] font-mono text-zinc-500 truncate max-w-[120px]">
                {user.email}
              </span>
            </div>

            <button
              onClick={onSignOut}
              title="Sign Out"
              className="p-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 rounded-xl border border-red-500/20 transition-colors flex items-center justify-center"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={onSignIn}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black font-extrabold text-xs uppercase tracking-wider rounded-xl hover:bg-zinc-200 transition-all shadow active:scale-95"
          >
            <UserIcon size={14} />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
