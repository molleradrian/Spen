import React, { useState } from 'react';
import { X, Plus, Briefcase, FolderPlus } from 'lucide-react';
import { Client } from '../types';

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateClient: (companyName: string, contactName: string, brandDNA: string) => void;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({
  isOpen,
  onClose,
  onCreateClient
}) => {
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [brandDNA, setBrandDNA] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;
    onCreateClient(companyName.trim(), contactName.trim(), brandDNA.trim());
    setCompanyName('');
    setContactName('');
    setBrandDNA('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#080A12] border border-white/20 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl font-mono">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Briefcase size={18} className="text-[#00E5CC]" />
            <h2 className="text-sm font-black uppercase text-white tracking-wider">
              Add New Zign Client
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
              Company / Client Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Corp Studio"
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#00E5CC]"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
              Contact Name
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Jane Doe"
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#00E5CC]"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
              Brand DNA / Guidelines
            </label>
            <textarea
              rows={3}
              value={brandDNA}
              onChange={(e) => setBrandDNA(e.target.value)}
              placeholder="Dark luxury aesthetic, Canon colors #610061, bold typography..."
              className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#00E5CC]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#00E5CC] hover:bg-[#00E5CC]/80 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow"
            >
              Create Client
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface NewProjectModalProps {
  isOpen: boolean;
  clients: Client[];
  selectedClientId: string;
  onClose: () => void;
  onCreateProject: (clientId: string, projectName: string, brief: string) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  clients,
  selectedClientId,
  onClose,
  onCreateProject
}) => {
  const [clientId, setClientId] = useState(selectedClientId || (clients[0]?.id || ''));
  const [projectName, setProjectName] = useState('');
  const [brief, setBrief] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    onCreateProject(clientId || clients[0]?.id || '', projectName.trim(), brief.trim());
    setProjectName('');
    setBrief('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-mono">
      <div className="bg-[#080A12] border border-white/20 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <FolderPlus size={18} className="text-[#007aff]" />
            <h2 className="text-sm font-black uppercase text-white tracking-wider">
              Add New Zign Project
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
              Select Client
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#007aff]"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
              Project Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Brand Identity Refresh 2026"
              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#007aff]"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase text-zinc-400 font-bold block mb-1">
              Project Brief
            </label>
            <textarea
              rows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Detailed project requirements, goals, deliverables..."
              className="w-full bg-zinc-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#007aff]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#007aff] hover:bg-[#007aff]/80 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
