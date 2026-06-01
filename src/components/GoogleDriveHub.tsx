import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cloud, 
  X, 
  Search, 
  RefreshCw, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  Download, 
  Upload, 
  Check, 
  Loader2,
  LogOut,
  FolderOpen
} from 'lucide-react';
import { 
  listDrawingsFromDrive, 
  saveDrawingToDrive, 
  savePngToDrive, 
  downloadFileContent, 
  deleteDriveFile,
  GoogleDriveFile 
} from '../services/googleDrive';

interface GoogleDriveHubProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  driveToken: string | null;
  onConnectDrive: () => Promise<string | null>;
  onDisconnectDrive: () => void;
  activeLayers: any[];
  activeDataUrl: string;
  loadedFileId: string | null;
  loadedFileName: string | null;
  onLoadWorkspace: (layers: any[], fileName: string, fileId: string) => void;
  onImportBackgroundImage: (dataUrl: string) => void;
}

export default function GoogleDriveHub({
  isOpen,
  onClose,
  user,
  driveToken,
  onConnectDrive,
  onDisconnectDrive,
  activeLayers,
  activeDataUrl,
  loadedFileId,
  loadedFileName,
  onLoadWorkspace,
  onImportBackgroundImage
}: GoogleDriveHubProps) {
  // Drive list state
  const [files, setFiles] = useState<GoogleDriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saveName, setSaveName] = useState(() => `Sketch ${new Date().toLocaleDateString()}`);
  
  // Control actions state
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [isSavingPng, setIsSavingPng] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [fileBeingDownloaded, setFileBeingDownloaded] = useState<string | null>(null);
  const [fileBeingDeleted, setFileBeingDeleted] = useState<string | null>(null);
  const [saveFormat, setSaveFormat] = useState<'json' | 'png'>('json');

  // Load files from Google Drive
  const fetchDriveFiles = useCallback(async (token: string, search = '') => {
    setIsLoading(true);
    try {
      const items = await listDrawingsFromDrive(token, search);
      setFiles(items);
    } catch (err: any) {
      console.error('Failed to list Google Drive files:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (isOpen && driveToken) {
      fetchDriveFiles(driveToken, searchQuery);
    }
  }, [isOpen, driveToken, fetchDriveFiles]);

  // Handle Search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (driveToken) {
      fetchDriveFiles(driveToken, searchQuery);
    }
  };

  // Helper trigger to search as user types
  useEffect(() => {
    if (!driveToken) return;
    const delayId = setTimeout(() => {
      fetchDriveFiles(driveToken, searchQuery);
    }, 400);
    return () => clearTimeout(delayId);
  }, [searchQuery, driveToken, fetchDriveFiles]);

  // Save changes to loaded file (Overwrite/PATCH)
  const handleUpdateWorkspace = async () => {
    if (!driveToken || !loadedFileId || !loadedFileName) return;
    setIsSavingWorkspace(true);
    setSaveSuccess(null);
    try {
      await saveDrawingToDrive(driveToken, loadedFileName, activeLayers, activeDataUrl, loadedFileId);
      setSaveSuccess('Successfully updated drawing on Google Drive!');
      setTimeout(() => setSaveSuccess(null), 3000);
      fetchDriveFiles(driveToken, searchQuery);
    } catch (err: any) {
      alert(`Failed to saving drawing updates: ${err.message || err}`);
    } finally {
      setIsSavingWorkspace(false);
    }
  };

  // New Save
  const handleNewSave = async () => {
    if (!driveToken) {
      alert('Please connect your Google Drive account first.');
      return;
    }
    if (!saveName.trim()) {
      alert('Please provide a name for your drawing.');
      return;
    }

    setSaveSuccess(null);
    if (saveFormat === 'json') {
      setIsSavingWorkspace(true);
      try {
        const res = await saveDrawingToDrive(driveToken, saveName, activeLayers, activeDataUrl);
        setSaveSuccess(`Saved workspace "${res.name}" successfully!`);
        setTimeout(() => setSaveSuccess(null), 3000);
        fetchDriveFiles(driveToken, searchQuery);
      } catch (err: any) {
        alert(`Failed to save: ${err.message || err}`);
      } finally {
        setIsSavingWorkspace(false);
      }
    } else {
      setIsSavingPng(true);
      try {
        const res = await savePngToDrive(driveToken, saveName, activeDataUrl);
        setSaveSuccess(`Exported PNG "${res.name}" successfully!`);
        setTimeout(() => setSaveSuccess(null), 3000);
        fetchDriveFiles(driveToken, searchQuery);
      } catch (err: any) {
        alert(`Failed to export: ${err.message || err}`);
      } finally {
        setIsSavingPng(false);
      }
    }
  };

  // Load file (Download)
  const handleLoadFile = async (file: GoogleDriveFile) => {
    if (!driveToken) return;
    
    // If it's a Workspace file, download and restore it
    if (file.name.endsWith('.s_drawing.json')) {
      const confirmed = window.confirm(`Load workspace "${file.name}"? This will replace your current workspace.`);
      if (!confirmed) return;

      setFileBeingDownloaded(file.id);
      try {
        const content = await downloadFileContent(driveToken, file.id);
        if (content && Array.isArray(content.layers)) {
          onLoadWorkspace(content.layers, file.name, file.id);
          onClose(); // Auto close hub on successfully restored sketch
        } else {
          alert('This file does not contain valid S-Pen drawings data.');
        }
      } catch (err: any) {
        alert(`Failed to load file: ${err.message || err}`);
      } finally {
        setFileBeingDownloaded(null);
      }
    } 
    // If it's a PNG image, offer to set as tracing layer background
    else if (file.mimeType.startsWith('image/')) {
      const confirmed = window.confirm(`Import image "${file.name}" as a tracing layer?`);
      if (!confirmed) return;

      setFileBeingDownloaded(file.id);
      try {
        // Retrieve binary image file details via Media download
        const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${driveToken}` }
        });
        if (!res.ok) throw new Error('Could not retrieve image data');
        
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            onImportBackgroundImage(reader.result);
            onClose(); // Auto-close hub
          }
        };
        reader.readAsDataURL(blob);
      } catch (err: any) {
        alert(`Failed to download image: ${err.message || err}`);
      } finally {
        setFileBeingDownloaded(null);
      }
    }
  };

  // Delete file (with MANDATORY confirmation)
  const handleDeleteFile = async (file: GoogleDriveFile) => {
    if (!driveToken) return;
    
    // MANDATORY confirmation dialog for mutated/deleted user owned data
    const confirmed = window.confirm(`Are you sure you want to delete "${file.name}" from Google Drive? This action cannot be undone.`);
    if (!confirmed) return;

    setFileBeingDeleted(file.id);
    try {
      await deleteDriveFile(driveToken, file.id);
      setFiles(prev => prev.filter(f => f.id !== file.id));
    } catch (err: any) {
      alert(`Failed to delete: ${err.message || err}`);
    } finally {
      setFileBeingDeleted(null);
    }
  };

  // Human clean sizes
  const formatSize = (bytesStr?: string) => {
    if (!bytesStr) return 'Unknown size';
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return 'Unknown size';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleOAuthLogin = async () => {
    try {
      setIsLoading(true);
      await onConnectDrive();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 border border-white/10 text-white w-full max-w-6xl h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl relative"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-white/15 px-6 py-4 bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-blue-400 border border-white/10 shadow-inner">
              <Cloud size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight uppercase">Workspace Cloud Storage</h2>
              <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">Secure Google Drive & Custom Picker</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Core Layout Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          
          {/* LEFT: Drive sync state & saving form */}
          <div className="col-span-1 md:col-span-5 border-r border-white/10 p-6 flex flex-col space-y-6 overflow-y-auto touch-auto bg-zinc-950/20">
            
            {/* Connection state */}
            {!driveToken ? (
              <div className="bg-zinc-900/60 p-6 rounded-2xl border border-white/15 text-center flex flex-col items-center space-y-4">
                <Cloud size={40} className="text-zinc-600 animate-pulse" />
                <div>
                  <h3 className="font-extrabold uppercase text-xs tracking-wider text-zinc-300">Google Drive Offline</h3>
                  <p className="text-[9.5px] text-zinc-400 mt-1 leading-relaxed">
                    Connect your Google Account to authorize drawing exports, cloud backups, and custom picking direct from your Drive.
                  </p>
                </div>
                
                {/* Official "Sign in with Google" styling implementation */}
                <button onClick={handleOAuthLogin} className="gsi-material-button w-full">
                  <div className="gsi-material-button-state"></div>
                  <div className="gsi-material-button-content-wrapper">
                    <div className="gsi-material-button-icon">
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents text-[11px] font-sans">Sign in with Google</span>
                  </div>
                </button>
              </div>
            ) : (
              <div className="bg-zinc-950/60 p-4 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img 
                      src={user?.photoURL || ''} 
                      className="w-10 h-10 rounded-full border border-white/20" 
                      alt="avatar"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="text-xs font-black truncate max-w-[150px]">{user?.displayName || "Connected Account"}</h4>
                      <p className="text-[9px] font-mono text-zinc-400 truncate max-w-[150px]">{user?.email || "Google Drive Active"}</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={onDisconnectDrive}
                    className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                    title="Disconnect Google Drive"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
                <div className="bg-blue-950/20 text-blue-400 border border-blue-900/40 p-2.5 rounded-xl flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[9px] font-mono uppercase tracking-wider">Drive Integration Authorized</span>
                </div>
              </div>
            )}

            {/* Overwrite Active loaded sketch if applicable */}
            {loadedFileId && loadedFileName && driveToken && (
              <div className="bg-zinc-900/80 p-5 rounded-2xl border border-blue-500/20 space-y-3 shadow-lg">
                <div className="flex items-center gap-2">
                  <FolderOpen size={14} className="text-blue-500 animate-pulse" />
                  <span className="text-[9.5px] font-mono uppercase tracking-widest text-zinc-300">Save Active Sketch</span>
                </div>
                <h4 className="text-xs font-bold truncate leading-tight text-white">{loadedFileName}</h4>
                <p className="text-[9.5px] text-zinc-400 leading-normal">
                  This drawing was loaded from Google Drive. Overwrite it directly to sync your workspace modifications.
                </p>
                <button
                  disabled={!driveToken || isSavingWorkspace}
                  onClick={handleUpdateWorkspace}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-40"
                >
                  {isSavingWorkspace ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Syncing Canvas...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Save Changes to Drive</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* General Save panel */}
            {driveToken && (
              <div className="bg-zinc-900/40 p-5 rounded-2xl border border-white/5 space-y-4">
                <div className="flex items-center gap-2">
                  <Upload size={14} className="text-zinc-400" />
                  <span className="text-[9.5px] font-mono uppercase tracking-widest text-zinc-300 font-bold">Export Drawing File</span>
                </div>
                
                {/* Form Elements */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Drawing Title</label>
                    <input
                      type="text"
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white/20 transition-colors"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-1.5">File Format</label>
                    <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-xl border border-white/5">
                      <button
                        onClick={() => setSaveFormat('json')}
                        className={`py-1.5 px-3 rounded-lg text-center text-[10px] uppercase font-bold transition-all ${saveFormat === 'json' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Workspace JSON
                      </button>
                      <button
                        onClick={() => setSaveFormat('png')}
                        className={`py-1.5 px-3 rounded-lg text-center text-[10px] uppercase font-bold transition-all ${saveFormat === 'png' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        Image PNG
                      </button>
                    </div>
                    <p className="text-[8px] font-mono text-zinc-400 leading-normal mt-1.5 px-0.5">
                      {saveFormat === 'json' 
                        ? "Workspace file format. Retains individual sketches, vector shapes, layers, pressure parameters, and and let you resume drawing."
                        : "Flattened PNG image. Suitable for printing, web previewing, and displaying directly inside normal image view apps."
                      }
                    </p>
                  </div>
                </div>

                <button
                  disabled={isSavingWorkspace || isSavingPng}
                  onClick={handleNewSave}
                  className="w-full py-2.5 rounded-xl bg-white text-black font-black text-xs uppercase tracking-wider hover:bg-neutral-200 transition-all flex items-center justify-center gap-2"
                >
                  {isSavingWorkspace || isSavingPng ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-black" />
                      <span>Saving to Drive...</span>
                    </>
                  ) : (
                    <>
                      <Cloud size={14} />
                      <span>Save as new on Drive</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Notification messages */}
            <AnimatePresence>
              {saveSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="p-3 py-2.5 rounded-2xl bg-emerald-950/35 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono flex items-center gap-2.5 justify-center font-bold shadow-lg"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm"
                  >
                    <Check size={10} strokeWidth={3} />
                  </motion.div>
                  <span>{saveSuccess}</span>
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          {/* RIGHT: Google Picker (File browser) */}
          <div className="col-span-1 md:col-span-7 p-6 flex flex-col space-y-4 overflow-hidden bg-zinc-900/20">
            <div className="flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-300 leading-none">Cloud Drive Explorer</h3>
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mt-1 block">Google Picker Emulation Panel</span>
              </div>

              {driveToken && (
                <button
                  onClick={() => fetchDriveFiles(driveToken, searchQuery)}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white/5 border border-white/5 hover:bg-white/10 rounded-xl text-[9px] uppercase tracking-wider font-extrabold text-zinc-300 disabled:opacity-40"
                >
                  <RefreshCw size={10} className={isLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              )}
            </div>

            {/* Offline notification */}
            {!driveToken ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-white/5 rounded-3xl min-h-[300px]">
                <Cloud size={32} className="text-zinc-700 mb-3" />
                <h4 className="text-xs uppercase font-extrabold text-zinc-500">Explorer Locked</h4>
                <p className="text-[9.5px] text-zinc-400 max-w-sm mt-1 leading-normal">
                  Connect your Google Drive account on the left side panel to list drawing workloads stored in your Cloud account.
                </p>
              </div>
            ) : (
              <>
                {/* Search Bar filter */}
                <form onSubmit={handleSearch} className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-zinc-950 border border-white/10 rounded-xl">
                    <Search size={14} className="text-zinc-500" />
                    <input
                      type="text"
                      className="bg-transparent border-none outline-none text-xs text-white placeholder:text-zinc-500 w-full"
                      placeholder="Search drawing files in Drive..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button 
                        type="button" 
                        onClick={() => setSearchQuery('')}
                        className="text-[9px] uppercase font-bold text-zinc-500 hover:text-white"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </form>

                {/* Drawings List */}
                <div className="flex-1 overflow-y-auto touch-auto pr-1 space-y-2">
                  {isLoading ? (
                    <div className="h-full flex flex-col justify-center items-center py-20 min-h-[250px]">
                      <Loader2 size={32} className="animate-spin text-zinc-400 mb-2" />
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Reading Workspace drawings...</p>
                    </div>
                  ) : files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center py-20 border-2 border-dashed border-white/5 rounded-2xl min-h-[250px]">
                      <FileText size={24} className="text-zinc-700 mb-2" />
                      <h4 className="text-xs font-bold uppercase text-zinc-500">No matching drawings</h4>
                      <p className="text-[9px] text-zinc-400 max-w-xs mt-1 leading-normal">
                        Could not locate drawings matching your query. Generate custom sketches or upload to S-Pen Canvas folder onto your Drive.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {files.map(f => {
                        const isWorkspace = f.name.endsWith('.s_drawing.json');
                        const isImage = f.mimeType.startsWith('image/');
                        const isDownloading = fileBeingDownloaded === f.id;
                        const isDeleting = fileBeingDeleted === f.id;

                        return (
                          <div
                            key={f.id}
                            className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950/40 hover:bg-zinc-900 border border-white/5 hover:border-white/10 transition-all group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* File icon preview */}
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${isWorkspace ? 'bg-amber-950/20 text-amber-500 border-amber-900/30' : 'bg-indigo-950/20 text-indigo-400 border-indigo-900/30'}`}>
                                {isWorkspace ? <FileText size={16} /> : <ImageIcon size={16} />}
                              </div>

                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-white truncate max-w-[280px] lg:max-w-[340px]" title={f.name}>
                                  {f.name}
                                </h4>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[9px] text-zinc-400 font-mono">
                                  <span className={`px-1 rounded text-[8px] font-bold ${isWorkspace ? 'bg-amber-950 text-amber-400' : 'bg-indigo-950 text-indigo-300'}`}>
                                    {isWorkspace ? 'Workspace' : 'PNG Image'}
                                  </span>
                                  <span>{formatSize(f.size)}</span>
                                  {f.modifiedTime && (
                                    <span>• {new Date(f.modifiedTime).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions Group */}
                            <div className="flex items-center gap-1.5 shrink-0 ml-4 opacity-70 group-hover:opacity-100 transition-opacity">
                              <button
                                disabled={isDownloading || isDeleting}
                                onClick={() => handleLoadFile(f)}
                                className={`p-2 rounded-xl border border-white/5 transition-all text-white flex items-center gap-1 ${
                                  isWorkspace 
                                    ? 'bg-amber-600 hover:bg-amber-700 hover:scale-105 active:scale-95' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105 active:scale-95'
                                }`}
                                title={isWorkspace ? "Load workspace drawing" : "Import as tracing image"}
                              >
                                {isDownloading ? (
                                  <Loader2 size={12} className="animate-spin text-white" />
                                ) : (
                                  <Download size={12} />
                                )}
                                <span className="text-[8.5px] uppercase font-mono font-bold tracking-wider px-0.5">
                                  {isWorkspace ? 'Load' : 'Import'}
                                </span>
                              </button>

                              <button
                                disabled={isDownloading || isDeleting}
                                onClick={() => handleDeleteFile(f)}
                                className="p-2 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-red-950/20 border border-white/5 transition-all active:scale-95"
                                title="Delete file from Google Drive"
                              >
                                {isDeleting ? (
                                  <Loader2 size={12} className="animate-spin text-red-400" />
                                ) : (
                                  <Trash2 size={12} />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>
      </motion.div>
      
      {/* Required materials button global css styling */}
      <style>{`
        .gsi-material-button {
          -moz-user-select: none;
          -webkit-user-select: none;
          -ms-user-select: none;
          -webkit-appearance: none;
          background-color: #f2f2f2;
          background-image: none;
          border: none;
          -webkit-border-radius: 20px;
          border-radius: 20px;
          -webkit-box-sizing: border-box;
          box-sizing: border-box;
          color: #1f1f1f;
          cursor: pointer;
          font-family: 'Roboto', arial, sans-serif;
          font-size: 14px;
          height: 40px;
          letter-spacing: 0.25px;
          outline: none;
          overflow: hidden;
          padding: 0 12px;
          position: relative;
          text-align: center;
          transition: background-color .218s, border-color .218s, box-shadow .218s;
          vertical-align: middle;
          white-space: nowrap;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .gsi-material-button .gsi-material-button-icon {
          height: 20px;
          min-width: 20px;
          width: 20px;
        }
        .gsi-material-button .gsi-material-button-content-wrapper {
          -webkit-align-items: center;
          align-items: center;
          display: flex;
          -webkit-flex-direction: row;
          flex-direction: row;
          -webkit-flex-wrap: nowrap;
          flex-wrap: nowrap;
          height: 100%;
          justify-content: center;
          position: relative;
          width: 100%;
        }
        .gsi-material-button .gsi-material-button-contents {
          -webkit-flex-grow: 1;
          flex-grow: 1;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          vertical-align: top;
          margin-left: 10px;
          text-align: left;
        }
        .gsi-material-button .gsi-material-button-state {
          -webkit-transition: opacity .218s;
          transition: opacity .218s;
          bottom: 0;
          left: 0;
          opacity: 0;
          position: absolute;
          right: 0;
          top: 0;
        }
        .gsi-material-button:hover {
          -webkit-box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15);
          box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15);
          background-color: #ffffff;
        }
        .gsi-material-button:hover .gsi-material-button-state {
          background-color: #303030;
          opacity: 0.04;
        }
        .gsi-material-button:active .gsi-material-button-state {
          background-color: #303030;
          opacity: 0.12;
        }
      `}</style>
    </div>
  );
}
