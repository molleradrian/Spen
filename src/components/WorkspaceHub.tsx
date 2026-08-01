import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Mail, 
  CheckSquare, 
  FileText, 
  Plus, 
  Send, 
  Inbox, 
  Trash2, 
  Check, 
  Cloud, 
  Loader2, 
  ExternalLink,
  ChevronRight,
  ListTodo,
  FileSpreadsheet,
  AlertCircle,
  Eye,
  Calendar,
  Layers,
  Palette,
  FileSignature,
  MessageSquare
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  updateDoc 
} from 'firebase/firestore';

interface WorkspaceHubProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  driveToken: string | null;
  activeDataUrl: string;
  onReauthorize?: () => Promise<string | null>;
}

// Keep Note structure
interface KeepNote {
  id?: string;
  userId: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  labels: string[];
  attachedCanvas?: string; // Data URL thumbnail
  createdAt: any;
  checklist?: { text: string; done: boolean }[];
}

// Tasks API Response Type
interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: 'completed' | 'needsAction';
  due?: string;
}

interface GoogleTaskList {
  id: string;
  title: string;
}

// Gmail Message list types
interface GmailMessageHeader {
  id: string;
  threadId: string;
}

interface GmailMessageDetail {
  id: string;
  snippet: string;
  subject?: string;
  from?: string;
  date?: string;
}

// Google Chat Types
interface GoogleChatSpace {
  name: string; // e.g. "spaces/AAAAxxx"
  displayName?: string;
  spaceType?: string;
}

interface GoogleChatMessage {
  name: string;
  text?: string;
  sender?: {
    displayName?: string;
    avatarUrl?: string;
  };
  createTime?: string;
}

const KEEP_COLORS = [
  { name: 'Default', value: 'bg-zinc-950/40 border-white/10 text-white' },
  { name: 'Red Accent', value: 'bg-red-950/45 border-red-500/20 text-red-100' },
  { name: 'Orange Amber', value: 'bg-amber-950/45 border-amber-500/20 text-amber-100' },
  { name: 'Mint Green', value: 'bg-emerald-950/45 border-emerald-500/20 text-emerald-100' },
  { name: 'Sky Cyan', value: 'bg-sky-950/45 border-sky-500/20 text-sky-100' },
  { name: 'Amethyst Purple', value: 'bg-violet-950/45 border-violet-500/20 text-violet-100' },
];

export default function WorkspaceHub({
  isOpen,
  onClose,
  user,
  driveToken,
  activeDataUrl,
  onReauthorize
}: WorkspaceHubProps) {
  const [activeTab, setActiveTab] = useState<'keep' | 'tasks' | 'gmail' | 'chat'>('keep');
  
  // Error notifications state
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const triggerReauthorize = async () => {
    if (!onReauthorize) return;
    try {
      const newToken = await onReauthorize();
      if (newToken) {
        setGmailError(null);
        setTasksError(null);
        setChatError(null);
      }
    } catch (e: any) {
      alert(`Authorization failed: ${e.message || e}`);
    }
  };

  // Gmail state
  const [emails, setEmails] = useState<GmailMessageDetail[]>([]);
  const [isEmailsLoading, setIsEmailsLoading] = useState(false);
  const [gmailTo, setGmailTo] = useState('');
  const [gmailSubject, setGmailSubject] = useState('My S Pen Sketch');
  const [gmailBody, setGmailBody] = useState('Attached is my latest sketch from the S Pen Pro Canvas!');
  const [attachCurrentCanvasInEmail, setAttachCurrentCanvasInEmail] = useState(true);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState<string | null>(null);

  // Tasks state
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [attachCurrentCanvasInTask, setAttachCurrentCanvasInTask] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskStatusMessage, setTaskStatusMessage] = useState<string | null>(null);

  // Keep Notes state (Firestore persisted)
  const [notes, setNotes] = useState<KeepNote[]>([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteColor, setNoteColor] = useState('bg-zinc-950/40 border-white/10 text-white');
  const [noteLabel, setNoteLabel] = useState('');
  const [attachCurrentCanvasInNote, setAttachCurrentCanvasInNote] = useState(false);
  const [noteChecklist, setNoteChecklist] = useState<{ text: string; done: boolean }[]>([]);
  const [newCheckItemText, setNewCheckItemText] = useState('');
  
  // Initial subscription to Keep Notes from Firestore
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'keep_notes'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const parsed = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as KeepNote[];
      setNotes(parsed);
    }, (err) => {
      console.error("Firestore Keep subscription error:", err);
    });
    return unsubscribe;
  }, [user]);

  // --- Gmail: Fetch Messages ---
  const fetchRecentEmails = useCallback(async () => {
    if (!driveToken) return;
    setIsEmailsLoading(true);
    setGmailError(null);
    try {
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5', {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          throw new Error('Access denied. Please authorize Gmail permissions by clicking Connect or Grant below.');
        }
        throw new Error('Could not fetch message list');
      }
      const listData = await res.json();
      
      const messageHeaders: GmailMessageHeader[] = listData.messages || [];
      const detailedMessages: GmailMessageDetail[] = [];

      for (const msg of messageHeaders) {
        const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
          headers: { Authorization: `Bearer ${driveToken}` }
        });
        if (detailRes.ok) {
          const detailData = await detailRes.json();
          const headers = detailData.payload?.headers || [];
          const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
          const from = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
          const date = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';
          
          detailedMessages.push({
            id: msg.id,
            snippet: detailData.snippet || '',
            subject,
            from,
            date: date ? new Date(date).toLocaleDateString() : ''
          });
        }
      }
      setEmails(detailedMessages);
    } catch (err: any) {
      console.error(err);
      setGmailError(err.message || 'Could not fetch message list');
    } finally {
      setIsEmailsLoading(false);
    }
  }, [driveToken]);

  // --- Gmail: Send Email (RFC 2822 Multipart) ---
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveToken) return;
    if (!gmailTo.trim()) {
      alert("Please provide a recipient email address.");
      return;
    }

    setIsSendingEmail(true);
    setEmailStatusMessage(null);

    try {
      let imageBase64 = '';
      if (attachCurrentCanvasInEmail && activeDataUrl) {
        // Strip data meta prefix
        imageBase64 = activeDataUrl.replace(/^data:image\/png;base64,/, '');
      }

      const boundary = "SPenDrawAppMultipartBoundary";
      
      let mail = "";
      mail += `To: ${gmailTo}\n`;
      mail += `Subject: ${gmailSubject}\n`;
      mail += "MIME-Version: 1.0\n";
      mail += `Content-Type: multipart/mixed; boundary="${boundary}"\n\n`;
      
      // Text Body Part
      mail += `--${boundary}\n`;
      mail += "Content-Type: text/html; charset=UTF-8\n";
      mail += "Content-Transfer-Encoding: 7bit\n\n";
      
      mail += `<html><body style="font-family: sans-serif; color: #222; padding: 15px;">`;
      mail += `<h2>S-Pen Creative Studio Drawing</h2>`;
      mail += `<p>${gmailBody.replace(/\n/g, '<br>')}</p>`;
      if (imageBase64) {
        mail += `<p><img src="cid:drawingInlineImage" alt="S Pen Pro Canvas Export" style="max-width:100%; border:1px solid #ddd; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1);" /></p>`;
      }
      mail += `<hr style="border:none; border-top:1px solid #eee; margin-top:30px;" />`;
      mail += `<p style="font-size: 11px; color: #888;">Rendered and dispatched immediately via verified Google Auth API on S-Pen Draw Pro Workspace.</p>`;
      mail += `</body></html>\n\n`;
      
      // Image Attachment Base64 Part
      if (imageBase64) {
        mail += `--${boundary}\n`;
        mail += "Content-Type: image/png\n";
        mail += "Content-Transfer-Encoding: base64\n";
        mail += "Content-ID: <drawingInlineImage>\n";
        mail += "Content-Disposition: inline; filename=\"spen_blueprint.png\"\n\n";
        mail += imageBase64.match(/.{1,76}/g)?.join('\n') + "\n\n";
      }
      
      mail += `--${boundary}--`;

      // Safe Base64URL encoding
      const encodedMsg = btoa(unescape(encodeURIComponent(mail)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${driveToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: encodedMsg })
      });

      if (!response.ok) {
        const errDetails = await response.json();
        throw new Error(errDetails.error?.message || 'SMTP transmission failure');
      }

      setEmailStatusMessage("🎉 S-Pen Drawing successfully sent via Gmail!");
      // Reset
      setGmailTo('');
      setGmailSubject('My S Pen Sketch');
      setGmailBody('Attached is my latest sketch from the S Pen Pro Canvas!');
      
      // Reload inbox list
      setTimeout(() => {
        fetchRecentEmails();
        setEmailStatusMessage(null);
      }, 3000);

    } catch (err: any) {
      alert(`Gmail Dispatch Failure: ${err.message || err}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  // --- Google Tasks: Fetch Lists & Tasks ---
  const fetchTaskListsAndItems = useCallback(async () => {
    if (!driveToken) return;
    setIsTasksLoading(true);
    setTasksError(null);
    try {
      const response = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          throw new Error('Access denied. Please authorize Google Tasks permissions by clicking Connect or Grant below.');
        }
        throw new Error('Could not fetch task lists');
      }
      const data = await response.json();
      const lists: GoogleTaskList[] = data.items || [];
      setTaskLists(lists);

      if (lists.length > 0) {
        setSelectedListId(prev => prev || lists[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setTasksError(err.message || 'Could not fetch task lists');
    } finally {
      setIsTasksLoading(false);
    }
  }, [driveToken]);

  // Load individual list tasks
  const fetchTasksForList = useCallback(async (listId: string) => {
    if (!driveToken || !listId) return;
    setIsTasksLoading(true);
    setTasksError(null);
    try {
      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=true`, {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          throw new Error('Access denied. Please authorize Google Tasks permissions by clicking Connect or Grant below.');
        }
        throw new Error('Could not fetch tasks for list');
      }
      const data = await res.json();
      setTasks(data.items || []);
    } catch (err: any) {
      console.error(err);
      setTasksError(err.message || 'Could not fetch tasks for list');
    } finally {
      setIsTasksLoading(false);
    }
  }, [driveToken]);

  // Effect to reload tasks when active list changes
  useEffect(() => {
    if (selectedListId && driveToken && activeTab === 'tasks') {
      fetchTasksForList(selectedListId);
    }
  }, [selectedListId, driveToken, activeTab, fetchTasksForList]);

  // --- Tasks: Toggle Status ---
  const handleToggleTaskStatus = async (task: GoogleTask) => {
    if (!driveToken || !selectedListId) return;
    const isCompleted = task.status === 'completed';
    const nextStatus = isCompleted ? 'needsAction' : 'completed';

    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));

    try {
      const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${selectedListId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${driveToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!response.ok) throw new Error('Could not update task status');
    } catch (err: any) {
      alert(`Google Tasks update failed: ${err.message || err}`);
      // Revert status
      fetchTasksForList(selectedListId);
    }
  };

  // --- Tasks: Create Task ---
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveToken || !selectedListId) return;
    if (!newTaskTitle.trim()) {
      alert("Please enter a task title.");
      return;
    }

    setIsCreatingTask(true);
    setTaskStatusMessage(null);

    try {
      let finalNotes = newTaskNotes;
      if (attachCurrentCanvasInTask && activeDataUrl) {
        finalNotes += `\n\n[Active Canvas Snapshot Attached]`;
      }

      const response = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${selectedListId}/tasks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${driveToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newTaskTitle,
          notes: finalNotes || undefined
        })
      });

      if (!response.ok) throw new Error('Could not add task');
      
      setNewTaskTitle('');
      setNewTaskNotes('');
      setTaskStatusMessage("Checkmark added to Google Tasks!");
      fetchTasksForList(selectedListId);

      setTimeout(() => setTaskStatusMessage(null), 3000);
    } catch (err: any) {
      alert(`Failed to append task: ${err.message || err}`);
    } finally {
      setIsCreatingTask(false);
    }
  };

  // --- Keep: Add Note (Firestore) ---
  const handleAddKeepNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!noteTitle.trim() && !noteContent.trim() && noteChecklist.length === 0) {
      alert("Please provide at least a title, text body, or checklists!");
      return;
    }

    try {
      const parsedLabels = noteLabel.trim() ? noteLabel.split(',').map(s => s.trim()) : [];
      const newNote: KeepNote = {
        userId: user.uid,
        title: noteTitle,
        content: noteContent,
        color: noteColor,
        isPinned: false,
        labels: parsedLabels,
        attachedCanvas: attachCurrentCanvasInNote ? activeDataUrl : undefined,
        createdAt: new Date(),
        checklist: noteChecklist.length > 0 ? noteChecklist : undefined
      };

      await addDoc(collection(db, 'keep_notes'), newNote);
      
      // Reset inputs
      setNoteTitle('');
      setNoteContent('');
      setNoteLabel('');
      setNoteChecklist([]);
      setAttachCurrentCanvasInNote(false);
    } catch (err: any) {
      console.error(err);
      alert("Firestore Error adding note: " + err.message);
    }
  };

  // Keep note checklist interaction
  const handleAddChecklistItem = () => {
    if (!newCheckItemText.trim()) return;
    setNoteChecklist(prev => [...prev, { text: newCheckItemText.trim(), done: false }]);
    setNewCheckItemText('');
  };

  const handleRemoveChecklistItem = (index: number) => {
    setNoteChecklist(prev => prev.filter((_, i) => i !== index));
  };

  // Keep delete note
  const handleDeleteKeepNote = async (id: string, name: string) => {
    const ok = window.confirm(`Permanently trash "${name || 'Untitled Note'}"?`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'keep_notes', id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  // --- Google Chat State & API Callbacks ---
  const [chatSpaces, setChatSpaces] = useState<GoogleChatSpace[]>([]);
  const [selectedSpaceName, setSelectedSpaceName] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<GoogleChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [newChatMessage, setNewChatMessage] = useState('');
  const [attachCurrentCanvasInChat, setAttachCurrentCanvasInChat] = useState(true);
  const [isSendingChatMessage, setIsSendingChatMessage] = useState(false);
  const [chatStatusMessage, setChatStatusMessage] = useState<string | null>(null);
  const [newSpaceDisplayName, setNewSpaceDisplayName] = useState('');
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);

  const fetchChatSpaces = useCallback(async () => {
    if (!driveToken) return;
    setIsChatLoading(true);
    setChatError(null);
    try {
      const res = await fetch('https://chat.googleapis.com/v1/spaces', {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          throw new Error('Access denied. Please authorize Google Chat permissions by clicking Grant below.');
        }
        throw new Error('Could not fetch Google Chat spaces');
      }
      const data = await res.json();
      const spaces: GoogleChatSpace[] = data.spaces || [];
      setChatSpaces(spaces);
      if (spaces.length > 0) {
        setSelectedSpaceName(prev => prev || spaces[0].name);
      }
    } catch (err: any) {
      console.error(err);
      setChatError(err.message || 'Could not fetch Google Chat spaces');
    } finally {
      setIsChatLoading(false);
    }
  }, [driveToken]);

  const fetchMessagesForSpace = useCallback(async (spaceName: string) => {
    if (!driveToken || !spaceName) return;
    setIsChatLoading(true);
    setChatError(null);
    try {
      const res = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages?pageSize=30`, {
        headers: { Authorization: `Bearer ${driveToken}` }
      });
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          throw new Error('Access denied. Please authorize Google Chat permissions.');
        }
        throw new Error('Could not fetch space messages');
      }
      const data = await res.json();
      setChatMessages(data.messages || []);
    } catch (err: any) {
      console.error(err);
      setChatError(err.message || 'Could not fetch space messages');
    } finally {
      setIsChatLoading(false);
    }
  }, [driveToken]);

  useEffect(() => {
    if (selectedSpaceName && driveToken && activeTab === 'chat') {
      fetchMessagesForSpace(selectedSpaceName);
    }
  }, [selectedSpaceName, driveToken, activeTab, fetchMessagesForSpace]);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveToken || !selectedSpaceName) return;
    if (!newChatMessage.trim()) {
      alert("Please enter a chat message text.");
      return;
    }

    const confirmed = window.confirm(`Send message to Google Chat space "${selectedSpaceName}"?`);
    if (!confirmed) return;

    setIsSendingChatMessage(true);
    setChatStatusMessage(null);

    try {
      let finalMsgText = newChatMessage;
      if (attachCurrentCanvasInChat && activeDataUrl) {
        finalMsgText += `\n\n🎨 [S Pen Canvas Export attached directly from Studio session]`;
      }

      const res = await fetch(`https://chat.googleapis.com/v1/${selectedSpaceName}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${driveToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: finalMsgText })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || 'Failed to send message to Google Chat');
      }

      setNewChatMessage('');
      setChatStatusMessage('💬 Message posted to Google Chat!');
      fetchMessagesForSpace(selectedSpaceName);
      setTimeout(() => setChatStatusMessage(null), 3000);
    } catch (err: any) {
      alert(`Google Chat dispatch failed: ${err.message || err}`);
    } finally {
      setIsSendingChatMessage(false);
    }
  };

  const handleCreateChatSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveToken || !newSpaceDisplayName.trim()) return;

    const confirmed = window.confirm(`Create a new Google Chat Space named "${newSpaceDisplayName.trim()}"?`);
    if (!confirmed) return;

    setIsCreatingSpace(true);
    try {
      const res = await fetch('https://chat.googleapis.com/v1/spaces', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${driveToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          spaceType: 'SPACE',
          displayName: newSpaceDisplayName.trim()
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || 'Could not create Google Chat Space');
      }
      const createdSpace = await res.json();
      setNewSpaceDisplayName('');
      alert(`Google Chat Space "${createdSpace.displayName || 'New Space'}" created!`);
      fetchChatSpaces();
    } catch (err: any) {
      alert(`Failed to create Space: ${err.message || err}`);
    } finally {
      setIsCreatingSpace(false);
    }
  };

  // Initial downloads triggers for Workspace APIs
  useEffect(() => {
    if (driveToken && isOpen) {
      if (activeTab === 'gmail' && emails.length === 0) {
        fetchRecentEmails();
      }
      if (activeTab === 'tasks' && taskLists.length === 0) {
        fetchTaskListsAndItems();
      }
      if (activeTab === 'chat' && chatSpaces.length === 0) {
        fetchChatSpaces();
      }
    }
  }, [driveToken, isOpen, activeTab, emails.length, taskLists.length, chatSpaces.length, fetchRecentEmails, fetchTaskListsAndItems, fetchChatSpaces]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 border border-white/10 text-white w-full max-w-6xl h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-white/15 px-6 py-4 bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-amber-500 border border-white/10 shadow-inner">
              <ListTodo size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-widest uppercase">Workspace Integration Desk</h2>
              <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">Gmail, Google Tasks, Keep & Google Chat</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modular Navigation Tabs */}
        <div className="grid grid-cols-4 border-b border-white/10 bg-zinc-950/50 p-2 gap-2">
          <button
            onClick={() => setActiveTab('keep')}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase text-[11px] tracking-wider transition-all ${
              activeTab === 'keep' 
                ? 'bg-zinc-800 text-amber-400 shadow' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <FileText size={14} className="text-amber-500" />
            Google Keep
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase text-[11px] tracking-wider transition-all ${
              activeTab === 'tasks' 
                ? 'bg-zinc-800 text-blue-400 shadow' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CheckSquare size={14} className="text-blue-500" />
            Google Tasks
          </button>

          <button
            onClick={() => setActiveTab('gmail')}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase text-[11px] tracking-wider transition-all ${
              activeTab === 'gmail' 
                ? 'bg-zinc-800 text-emerald-400 shadow' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Mail size={14} className="text-emerald-500" />
            Gmail
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase text-[11px] tracking-wider transition-all ${
              activeTab === 'chat' 
                ? 'bg-zinc-800 text-purple-400 shadow' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare size={14} className="text-purple-400" />
            Google Chat
          </button>
        </div>

        {/* Global Google Status check */}
        {!driveToken && (activeTab === 'tasks' || activeTab === 'gmail' || activeTab === 'chat') ? (
          <div className="bg-amber-950/30 border-y border-amber-900/15 px-6 py-4 flex flex-col sm:flex-row items-center gap-4 justify-between text-left">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-amber-500 shrink-0" size={20} />
              <div>
                <h4 className="text-xs font-bold uppercase text-amber-400 tracking-wider">Cloud Auth Offline</h4>
                <p className="text-[10px] text-zinc-400 max-w-xl leading-relaxed">
                  Gmail, Google Tasks, and Google Chat require live API token access to synchronize with your Workspace. Link your Google account to authorize secure communication.
                </p>
              </div>
            </div>
            {onReauthorize && (
              <button
                onClick={triggerReauthorize}
                className="w-full sm:w-auto shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
              >
                Connect Account
              </button>
            )}
          </div>
        ) : (gmailError || tasksError || chatError) && (activeTab === 'gmail' || activeTab === 'tasks' || activeTab === 'chat') ? (
          <div className="bg-red-950/20 border-y border-red-900/15 px-6 py-4 flex flex-col sm:flex-row items-center gap-4 justify-between text-left">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-400 shrink-0" size={20} />
              <div>
                <h4 className="text-xs font-bold uppercase text-red-400 tracking-wider">Additional Permissions Required</h4>
                <p className="text-[10px] text-zinc-400 max-w-xl leading-relaxed">
                  The Google account is connected, but Workspace permissions haven't been granted yet. Grant these scopes to use Gmail, Tasks, and Google Chat.
                </p>
              </div>
            </div>
            {onReauthorize && (
              <button
                onClick={triggerReauthorize}
                className="w-full sm:w-auto shrink-0 px-4 py-2 bg-red-650 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
              >
                Grant Permissions
              </button>
            )}
          </div>
        ) : null}

        {/* Body Segment */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            
            {/* 1. GOOGLE KEEP TAB */}
            {activeTab === 'keep' && (
              <motion.div 
                key="keep-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="h-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden"
              >
                {/* Note composer forms */}
                <div className="lg:col-span-5 border-r border-white/10 p-6 overflow-y-auto touch-auto space-y-6 bg-zinc-950/20">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Pinboard Note Composer</h3>
                    <p className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Create custom grid stickies</p>
                  </div>

                  <form onSubmit={handleAddKeepNote} className="space-y-4">
                    <div>
                      <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Sticky Title</label>
                      <input 
                        type="text" 
                        value={noteTitle} 
                        onChange={(e) => setNoteTitle(e.target.value)}
                        placeholder="Idea Board"
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Message Content</label>
                      <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        rows={3}
                        placeholder="Write something creative..."
                        className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-colors resize-none"
                      />
                    </div>

                    {/* Checklists builder */}
                    <div className="border border-white/5 rounded-2xl p-3 bg-zinc-950/40 space-y-3">
                      <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">List Checklist Items</span>
                      
                      {noteChecklist.map((item, index) => (
                        <div key={index} className="flex items-center justify-between gap-2 bg-zinc-950 px-3 py-1.5 rounded-xl border border-white/5 text-[11px]">
                          <span className="text-zinc-300 truncate">{item.text}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemoveChecklistItem(index)}
                            className="text-[9px] font-bold text-red-400 hover:text-red-300 uppercase font-mono px-1"
                          >
                            Remove
                          </button>
                        </div>
                      ))}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCheckItemText}
                          onChange={(e) => setNewCheckItemText(e.target.value)}
                          placeholder="Add detail bullet..."
                          className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-3 py-1.5 text-[11.5px] placeholder:text-zinc-600 focus:outline-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddChecklistItem();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleAddChecklistItem}
                          className="bg-white hover:bg-neutral-200 text-black px-3 rounded-xl font-bold text-xs"
                        >
                          Add
                        </button>
                      </div>
                    </div>

                    {/* Style selector panel */}
                    <div className="grid grid-cols-2 gap-3 bg-zinc-950/40 p-3 rounded-2xl border border-white/5">
                      <div>
                        <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Desk Color</span>
                        <select 
                          value={noteColor} 
                          onChange={(e) => setNoteColor(e.target.value)}
                          className="w-full bg-zinc-950 border border-white/10 text-xs py-1.5 px-2 rounded-xl focus:outline-none text-zinc-300"
                        >
                          {KEEP_COLORS.map(c => (
                            <option key={c.value} value={c.value}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Tags/Comma-sep</span>
                        <input 
                          type="text" 
                          placeholder="Remix, S-Pen"
                          value={noteLabel}
                          onChange={(e) => setNoteLabel(e.target.value)}
                          className="w-full bg-zinc-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none text-white placeholder:text-zinc-650"
                        />
                      </div>
                    </div>

                    {/* Capture Active Drawing embed selector */}
                    {activeDataUrl && (
                      <label className="flex items-center gap-2 px-3 py-2 border border-blue-500/15 bg-blue-950/10 hover:bg-blue-950/20 rounded-xl cursor-pointer select-none transition-colors">
                        <input 
                          type="checkbox" 
                          className="accent-blue-500 scale-105"
                          checked={attachCurrentCanvasInNote}
                          onChange={(e) => setAttachCurrentCanvasInNote(e.target.checked)}
                        />
                        <div className="text-[9.5px]">
                          <span className="text-blue-400 font-bold uppercase font-mono block">Embed Current Canvas</span>
                          <span className="text-zinc-400 leading-none">Save vector drawing frame directly inside Note</span>
                        </div>
                      </label>
                    )}

                    <button
                      type="submit"
                      className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black font-black uppercase text-xs tracking-wider hover:bg-neutral-200 transition-all rounded-xl"
                    >
                      <Plus size={14} />
                      <span>Post to Keep Pinboard</span>
                    </button>
                  </form>
                </div>

                {/* Pinboard display grid */}
                <div className="lg:col-span-7 p-6 overflow-y-auto touch-auto space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest">Pinboard Live Canvas</h3>
                      <p className="text-[10px] text-zinc-400 uppercase font-mono tracking-widest">Cloud sticky cards synced in real-time</p>
                    </div>
                  </div>

                  {notes.length === 0 ? (
                    <div className="border border-dashed border-white/10 py-24 rounded-3xl text-center flex flex-col justify-center items-center">
                      <FileText size={32} className="text-zinc-700 mb-2" />
                      <h4 className="text-xs uppercase font-extrabold text-zinc-500">Board Empty</h4>
                      <p className="text-[9px] text-zinc-400 mt-1 max-w-xs leading-normal">
                        Create sticky notes on the left pane to secure your creative vectors, ideas, and checklists permanently.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {notes.map(n => (
                        <div 
                          key={n.id} 
                          className={`border border-white/5 p-4 rounded-3xl flex flex-col justify-between hover:scale-[1.02] hover:border-white/15 transition-all text-left shadow-lg ${n.color}`}
                        >
                          <div>
                            <div className="flex justify-between items-start gap-3">
                              <h4 className="text-xs font-black uppercase tracking-wider line-clamp-1 truncate max-w-[170px]">{n.title || '(Untitled Note)'}</h4>
                              <button 
                                onClick={() => handleDeleteKeepNote(n.id!, n.title)}
                                className="opacity-0 group-hover:opacity-100 p-1 bg-red-950/20 text-red-400 hover:text-red-300 rounded-lg translate-y-[-2px]"
                                style={{ transition: 'opacity 0.2s', display: 'block' }}
                                title="Delete note"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>

                            {/* Attched drawing preview */}
                            {n.attachedCanvas && (
                              <div className="my-2 border border-white/5 rounded-xl bg-black/40 overflow-hidden select-none pointer-events-none relative h-24 flex items-center justify-center">
                                <img src={n.attachedCanvas} className="max-w-full max-h-full object-contain filter brightness-95" alt="Attached S Pen sketch" />
                                <div className="absolute top-1 left-2 bg-black/60 backdrop-blur border border-white/10 px-1.5 py-0.5 rounded text-[7.5px] uppercase font-mono font-bold tracking-widest text-zinc-400">
                                  Embedded Drawing
                                </div>
                              </div>
                            )}

                            <p className="text-[11px] leading-relaxed opacity-85 mt-2 whitespace-pre-wrap">{n.content}</p>

                            {/* Checklist display */}
                            {n.checklist && n.checklist.length > 0 && (
                              <div className="space-y-1 mt-3 bg-black/25 p-2 rounded-2xl border border-white/5">
                                {n.checklist.map((item, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5 text-[9.5px]">
                                    <div className={`w-3 h-3 rounded flex items-center justify-center border ${item.done ? 'bg-amber-500 border-amber-600 text-black' : 'border-white/20'}`}>
                                      {item.done && <Check size={8} />}
                                    </div>
                                    <span className={`${item.done ? 'line-through opacity-45' : 'text-zinc-200'}`}>{item.text}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Labels array */}
                            {n.labels && n.labels.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3 select-none">
                                {n.labels.map(l => (
                                  <span key={l} className="bg-black/40 border border-white/10 text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-lg text-zinc-300 font-bold">
                                    #{l}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[8px] font-mono opacity-40 mt-4 pt-1 border-t border-white/5">
                            <span>PINBOARD NOTE</span>
                            <span>{n.createdAt?.toDate ? n.createdAt.toDate().toLocaleDateString() : new Date(n.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* 2. GOOGLE TASKS TAB */}
            {activeTab === 'tasks' && (
              <motion.div 
                key="tasks-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="h-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden animate-none"
              >
                {!driveToken ? (
                  <div className="col-span-12 flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                    <CheckSquare size={36} className="text-zinc-600 mb-2 animate-pulse" />
                    <h3 className="text-xs uppercase font-extrabold text-zinc-500">Google Connection Offline</h3>
                    <p className="text-[10px] text-zinc-400 max-w-sm mt-1.5 leading-relaxed">
                      Please authenticate your account on Google picker storage panel first, then you can list, get, and commit tasks to Google Tasks API.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* New task list and items dispatcher */}
                    <div className="lg:col-span-5 border-r border-white/10 p-6 overflow-y-auto touch-auto space-y-6 bg-zinc-950/20">
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Google Tasks Dispatcher</h3>
                        <p className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Deploy reminders direct to cloud</p>
                      </div>

                      {/* Select Task list */}
                      <div>
                        <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-1 font-bold">Select Active TaskList</label>
                        {isTasksLoading && taskLists.length === 0 ? (
                          <div className="flex items-center gap-2 p-2.5 bg-zinc-950/50 rounded-xl border border-white/10 text-xs text-zinc-500">
                            <Loader2 size={12} className="animate-spin" />
                            Loading cloud lists...
                          </div>
                        ) : (
                          <select
                            value={selectedListId}
                            onChange={(e) => setSelectedListId(e.target.value)}
                            className="w-full bg-zinc-950 border border-white/10 text-xs py-2 px-3 rounded-xl focus:outline-none text-zinc-350 font-bold"
                          >
                            {taskLists.map(l => (
                              <option key={l.id} value={l.id}>{l.title}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      <form onSubmit={handleCreateTask} className="space-y-4 pt-1">
                        <div>
                          <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Task Title <span className="text-red-500">*</span></label>
                          <input 
                            type="text" 
                            required
                            value={newTaskTitle} 
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Fine-tune vectors on drawing"
                            className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-650 focus:outline-none focus:border-white/20 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Task Details/Notes</label>
                          <textarea
                            value={newTaskNotes}
                            onChange={(e) => setNewTaskNotes(e.target.value)}
                            rows={3}
                            placeholder="Remember to export layers with pressure..."
                            className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-650 focus:outline-none focus:border-white/20 transition-colors resize-none"
                          />
                        </div>

                        {/* Attach metadata notice */}
                        {activeDataUrl && (
                          <label className="flex items-center gap-2.5 px-3 py-2 border border-blue-500/15 bg-blue-950/15 hover:bg-blue-950/25 rounded-xl cursor-pointer select-none transition-colors">
                            <input 
                              type="checkbox" 
                              className="accent-blue-500 scale-105"
                              checked={attachCurrentCanvasInTask}
                              onChange={(e) => setAttachCurrentCanvasInTask(e.target.checked)}
                            />
                            <div className="text-[9.5px]">
                              <span className="text-blue-400 font-bold uppercase font-mono block">Append Canvas metadata link</span>
                              <span className="text-zinc-400">Packs canvas drawing indicators directly to task details</span>
                            </div>
                          </label>
                        )}

                        <button
                          type="submit"
                          disabled={isCreatingTask}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black font-black uppercase text-xs tracking-wider hover:bg-neutral-200 transition-all rounded-xl disabled:opacity-40"
                        >
                          {isCreatingTask ? (
                            <>
                              <Loader2 size={14} className="animate-spin text-black" />
                              <span>Dispatching...</span>
                            </>
                          ) : (
                            <>
                              <CheckSquare size={14} />
                              <span>Append to Tasks API</span>
                            </>
                          )}
                        </button>
                      </form>

                      {taskStatusMessage && (
                        <div className="p-3 rounded-xl bg-blue-950/20 text-blue-400 border border-blue-900/40 text-[9.5px] font-mono text-center font-bold">
                          {taskStatusMessage}
                        </div>
                      )}
                    </div>

                    {/* Tasks items list */}
                    <div className="lg:col-span-7 p-6 overflow-y-auto touch-auto space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">Google Workspace Tasks</h3>
                          <p className="text-[9px] text-zinc-400 uppercase font-mono tracking-widest mt-0.5">Task list sync items feed</p>
                        </div>
                      </div>

                      {tasksError ? (
                        <div className="border border-red-500/10 bg-red-950/20 p-8 rounded-3xl text-center flex flex-col items-center justify-center space-y-4">
                          <AlertCircle className="text-red-400" size={32} />
                          <div className="space-y-1">
                            <h4 className="text-xs uppercase font-extrabold text-zinc-300">Could Not Synchronize Tasks</h4>
                            <p className="text-[9.5px] text-zinc-400 max-w-sm leading-relaxed">{tasksError}</p>
                          </div>
                          {onReauthorize && (
                            <button
                              onClick={triggerReauthorize}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                            >
                              Sync & Grant Permissions
                            </button>
                          )}
                        </div>
                      ) : isTasksLoading ? (
                        <div className="py-24 text-center">
                          <Loader2 size={24} className="animate-spin text-zinc-400 mx-auto mb-2" />
                          <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Syncing live list tasks...</span>
                        </div>
                      ) : tasks.length === 0 ? (
                        <div className="border border-dashed border-white/10 py-24 rounded-3xl text-center">
                          <CheckSquare size={24} className="text-zinc-700 mb-2" />
                          <h4 className="text-xs uppercase font-extrabold text-zinc-500">No checklists items</h4>
                          <p className="text-[9px] text-zinc-400 mt-1">This Google Tasks list has no registered workloads.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {tasks.map(t => {
                            const isCompleted = t.status === 'completed';
                            return (
                              <div 
                                key={t.id}
                                className={`p-4 rounded-2xl bg-zinc-950/40 border border-white/5 flex gap-3.5 items-start transition-all ${isCompleted ? 'opacity-50' : 'hover:border-white/10 bg-zinc-900/20'}`}
                              >
                                <button 
                                  onClick={() => handleToggleTaskStatus(t)}
                                  className={`w-5 h-5 rounded-lg shrink-0 mt-0.5 flex items-center justify-center border transition-colors ${isCompleted ? 'bg-blue-600 border-blue-700 text-white' : 'border-white/20 hover:border-white/40'}`}
                                >
                                  {isCompleted && <Check size={12} />}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <h4 className={`text-xs font-bold text-white truncate max-w-full ${isCompleted ? 'line-through text-zinc-550' : ''}`}>{t.title}</h4>
                                  {t.notes && (
                                    <p className="text-[10px] text-zinc-400 mt-1 whitespace-pre-wrap">{t.notes}</p>
                                  )}
                                  {t.due && (
                                    <div className="flex items-center gap-1.5 text-[8.5px] font-mono text-zinc-500 mt-1.5 uppercase">
                                      <Calendar size={10} />
                                      Due {new Date(t.due).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* 3. GMAIL DISPATCHER TAB */}
            {activeTab === 'gmail' && (
              <motion.div 
                key="gmail-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="h-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden"
              >
                {!driveToken ? (
                  <div className="col-span-12 flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                    <Mail size={36} className="text-zinc-600 mb-2 animate-pulse" />
                    <h3 className="text-xs uppercase font-extrabold text-zinc-500">Google Connection Offline</h3>
                    <p className="text-[10px] text-zinc-400 max-w-sm mt-1.5 leading-relaxed">
                      Connect your account on the Cloud Drive Storage selector panel to unlock direct emails dispatch and drafts retrieval.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Compose panel */}
                    <div className="lg:col-span-5 border-r border-white/10 p-6 overflow-y-auto touch-auto space-y-6 bg-zinc-950/20">
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Gmail Studio Dispatch</h3>
                        <p className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Draft & send custom drawing vectors</p>
                      </div>

                      <form onSubmit={handleSendEmail} className="space-y-4">
                        <div>
                          <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">To (Recipient Email) <span className="text-red-500">*</span></label>
                          <input 
                            type="email" 
                            required
                            placeholder="colleague@domain.com"
                            value={gmailTo}
                            onChange={(e) => setGmailTo(e.target.value)}
                            className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-650 focus:outline-none focus:border-white/20 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Subject</label>
                          <input 
                            type="text" 
                            placeholder="My S Pen Sketch"
                            value={gmailSubject}
                            onChange={(e) => setGmailSubject(e.target.value)}
                            className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-650 focus:outline-none focus:border-white/20 transition-colors"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">HTML Message Details</label>
                          <textarea
                            value={gmailBody}
                            onChange={(e) => setGmailBody(e.target.value)}
                            rows={3}
                            placeholder="Here is the vector shape blueprint I just made..."
                            className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-650 focus:outline-none focus:border-white/20 transition-colors resize-none"
                          />
                        </div>

                        {/* Interactive toggle */}
                        {activeDataUrl && (
                          <label className="flex items-center gap-2.5 px-3 py-2 border border-emerald-500/15 bg-emerald-950/15 hover:bg-emerald-950/25 rounded-xl cursor-pointer select-none transition-colors">
                            <input 
                              type="checkbox" 
                              className="accent-emerald-500 scale-105"
                              checked={attachCurrentCanvasInEmail}
                              onChange={(e) => setAttachCurrentCanvasInEmail(e.target.checked)}
                            />
                            <div className="text-[9.5px]">
                              <span className="text-emerald-400 font-bold uppercase font-mono block">Inline Active S Pen Sketch</span>
                              <span className="text-zinc-400">Attach current canvas as inline image</span>
                            </div>
                          </label>
                        )}

                        <button
                          type="submit"
                          disabled={isSendingEmail}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black font-black uppercase text-xs tracking-wider hover:bg-neutral-200 transition-all rounded-xl disabled:opacity-40"
                        >
                          {isSendingEmail ? (
                            <>
                              <Loader2 size={14} className="animate-spin text-black" />
                              <span>Dispatching Email...</span>
                            </>
                          ) : (
                            <>
                              <Send size={14} />
                              <span>Send with Gmail API</span>
                            </>
                          )}
                        </button>
                      </form>

                      {emailStatusMessage && (
                        <div className="p-3.5 rounded-xl bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 text-[10px] font-mono text-center font-bold">
                          {emailStatusMessage}
                        </div>
                      )}
                    </div>

                    {/* Inbox Feed logs */}
                    <div className="lg:col-span-7 p-6 overflow-y-auto touch-auto space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">Gmail Inbox Feed</h3>
                          <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mt-0.5">Live read receipts indicator</span>
                        </div>
                        <button
                          onClick={fetchRecentEmails}
                          className="text-[9.5px] uppercase font-bold text-zinc-400 hover:text-white pb-0.5 border-b border-dashed border-white/20 transition-all"
                        >
                          Reload Inbox
                        </button>
                      </div>

                      {gmailError ? (
                        <div className="border border-red-500/10 bg-red-950/20 p-8 rounded-3xl text-center flex flex-col items-center justify-center space-y-4">
                          <AlertCircle className="text-red-400" size={32} />
                          <div className="space-y-1">
                            <h4 className="text-xs uppercase font-extrabold text-zinc-300">Could Not Access Email Feed</h4>
                            <p className="text-[9.5px] text-zinc-400 max-w-sm leading-relaxed">{gmailError}</p>
                          </div>
                          {onReauthorize && (
                            <button
                              onClick={triggerReauthorize}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                            >
                              Sync & Grant Permissions
                            </button>
                          )}
                        </div>
                      ) : isEmailsLoading ? (
                        <div className="py-24 text-center">
                          <Loader2 size={24} className="animate-spin text-zinc-400 mx-auto mb-2" />
                          <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Retrieving Gmail message details...</span>
                        </div>
                      ) : emails.length === 0 ? (
                        <div className="border border-dashed border-white/10 py-24 rounded-3xl text-center">
                          <Inbox size={24} className="text-zinc-700 mb-2" />
                          <h4 className="text-xs uppercase font-extrabold text-zinc-500">Inbox Clean</h4>
                          <p className="text-[9px] text-zinc-400 mt-1">No recent dispatch headers detected on this mailbox.</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {emails.map(e => (
                            <div 
                              key={e.id}
                              className="p-3.5 rounded-2xl bg-zinc-950/45 border border-white/5 hover:border-white/10 transition-all text-left space-y-1 group"
                            >
                              <div className="flex justify-between items-start gap-4">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 truncate max-w-[200px]">{e.from}</span>
                                <span className="text-[8.5px] font-mono text-zinc-500 uppercase">{e.date}</span>
                              </div>
                              <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">{e.subject}</h4>
                              <p className="text-[10px] text-zinc-400 truncate line-clamp-1">{e.snippet}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* 4. GOOGLE CHAT TAB */}
            {activeTab === 'chat' && (
              <motion.div 
                key="chat-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="h-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden"
              >
                {!driveToken ? (
                  <div className="col-span-12 flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                    <MessageSquare size={36} className="text-zinc-600 mb-2 animate-pulse" />
                    <h3 className="text-xs uppercase font-extrabold text-zinc-500">Google Connection Offline</h3>
                    <p className="text-[10px] text-zinc-400 max-w-sm mt-1.5 leading-relaxed">
                      Connect your account on the Cloud Drive panel to interact with Google Chat spaces and messages.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Space selection & message composer */}
                    <div className="lg:col-span-5 border-r border-white/10 p-6 overflow-y-auto touch-auto space-y-6 bg-zinc-950/20">
                      <div className="space-y-1">
                        <h3 className="text-xs font-bold text-purple-400 uppercase tracking-widest">Google Chat Dispatcher</h3>
                        <p className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Send messages & artwork to Chat Spaces</p>
                      </div>

                      {/* Select active space */}
                      <div>
                        <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-1 font-bold">Select Chat Space</label>
                        {isChatLoading && chatSpaces.length === 0 ? (
                          <div className="flex items-center gap-2 p-2.5 bg-zinc-950/50 rounded-xl border border-white/10 text-xs text-zinc-500">
                            <Loader2 size={12} className="animate-spin" />
                            Loading Chat spaces...
                          </div>
                        ) : chatSpaces.length === 0 ? (
                          <p className="text-[10px] text-zinc-500 font-mono">No spaces found. Create one below!</p>
                        ) : (
                          <select
                            value={selectedSpaceName}
                            onChange={(e) => setSelectedSpaceName(e.target.value)}
                            className="w-full bg-zinc-950 border border-white/10 text-xs py-2 px-3 rounded-xl focus:outline-none text-zinc-300 font-bold"
                          >
                            {chatSpaces.map(s => (
                              <option key={s.name} value={s.name}>
                                {s.displayName || s.name} ({s.spaceType || 'SPACE'})
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Post message form */}
                      <form onSubmit={handleSendChatMessage} className="space-y-4 pt-1">
                        <div>
                          <label className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">Message Text <span className="text-red-500">*</span></label>
                          <textarea
                            required
                            value={newChatMessage}
                            onChange={(e) => setNewChatMessage(e.target.value)}
                            rows={3}
                            placeholder="Share an update or feedback with the team..."
                            className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-zinc-650 focus:outline-none focus:border-white/20 transition-colors resize-none"
                          />
                        </div>

                        {activeDataUrl && (
                          <label className="flex items-center gap-2.5 px-3 py-2 border border-purple-500/15 bg-purple-950/15 hover:bg-purple-950/25 rounded-xl cursor-pointer select-none transition-colors">
                            <input 
                              type="checkbox" 
                              className="accent-purple-500 scale-105"
                              checked={attachCurrentCanvasInChat}
                              onChange={(e) => setAttachCurrentCanvasInChat(e.target.checked)}
                            />
                            <div className="text-[9.5px]">
                              <span className="text-purple-400 font-bold uppercase font-mono block">Attach Canvas Export Notice</span>
                              <span className="text-zinc-400">Includes current canvas session reference in message</span>
                            </div>
                          </label>
                        )}

                        <button
                          type="submit"
                          disabled={isSendingChatMessage || !selectedSpaceName}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-white text-black font-black uppercase text-xs tracking-wider hover:bg-neutral-200 transition-all rounded-xl disabled:opacity-40"
                        >
                          {isSendingChatMessage ? (
                            <>
                              <Loader2 size={14} className="animate-spin text-black" />
                              <span>Sending to Google Chat...</span>
                            </>
                          ) : (
                            <>
                              <Send size={14} />
                              <span>Post to Google Chat</span>
                            </>
                          )}
                        </button>
                      </form>

                      {chatStatusMessage && (
                        <div className="p-3 rounded-xl bg-purple-950/30 text-purple-300 border border-purple-900/40 text-[9.5px] font-mono text-center font-bold">
                          {chatStatusMessage}
                        </div>
                      )}

                      {/* Create Space section */}
                      <div className="pt-4 border-t border-white/10 space-y-3">
                        <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">Create New Chat Space</span>
                        <form onSubmit={handleCreateChatSpace} className="flex gap-2">
                          <input 
                            type="text" 
                            value={newSpaceDisplayName}
                            onChange={(e) => setNewSpaceDisplayName(e.target.value)}
                            placeholder="Space Display Name"
                            className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-650 focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={isCreatingSpace || !newSpaceDisplayName.trim()}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3 py-2 rounded-xl transition-colors disabled:opacity-40 flex items-center gap-1.5"
                          >
                            {isCreatingSpace ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                            <span>Create</span>
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Messages Feed */}
                    <div className="lg:col-span-7 p-6 overflow-y-auto touch-auto space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-300">Space Messages Feed</h3>
                          <p className="text-[9px] text-zinc-400 uppercase font-mono tracking-widest mt-0.5">Live conversation thread</p>
                        </div>
                        {selectedSpaceName && (
                          <button
                            onClick={() => fetchMessagesForSpace(selectedSpaceName)}
                            className="text-[9.5px] uppercase font-bold text-zinc-400 hover:text-white pb-0.5 border-b border-dashed border-white/20 transition-all"
                          >
                            Refresh Thread
                          </button>
                        )}
                      </div>

                      {chatError ? (
                        <div className="border border-red-500/10 bg-red-950/20 p-8 rounded-3xl text-center flex flex-col items-center justify-center space-y-4">
                          <AlertCircle className="text-red-400" size={32} />
                          <div className="space-y-1">
                            <h4 className="text-xs uppercase font-extrabold text-zinc-300">Could Not Load Messages</h4>
                            <p className="text-[9.5px] text-zinc-400 max-w-sm leading-relaxed">{chatError}</p>
                          </div>
                          {onReauthorize && (
                            <button
                              onClick={triggerReauthorize}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors"
                            >
                              Sync & Grant Permissions
                            </button>
                          )}
                        </div>
                      ) : isChatLoading ? (
                        <div className="py-24 text-center">
                          <Loader2 size={24} className="animate-spin text-zinc-400 mx-auto mb-2" />
                          <span className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Syncing space messages...</span>
                        </div>
                      ) : chatMessages.length === 0 ? (
                        <div className="border border-dashed border-white/10 py-24 rounded-3xl text-center">
                          <MessageSquare size={24} className="text-zinc-700 mb-2" />
                          <h4 className="text-xs uppercase font-extrabold text-zinc-500">No Messages Yet</h4>
                          <p className="text-[9px] text-zinc-400 mt-1">Be the first to post a message to this Google Chat space.</p>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {chatMessages.map(msg => (
                            <div 
                              key={msg.name}
                              className="p-3.5 rounded-2xl bg-zinc-950/45 border border-white/5 hover:border-white/10 transition-all text-left space-y-1"
                            >
                              <div className="flex justify-between items-start gap-4">
                                <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 truncate">
                                  {msg.sender?.displayName || 'User'}
                                </span>
                                {msg.createTime && (
                                  <span className="text-[8.5px] font-mono text-zinc-500 uppercase">
                                    {new Date(msg.createTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap">{msg.text || '(Empty Message)'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
