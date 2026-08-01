import React, { useEffect, useState, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  setDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, signIn, signOut } from './firebase';

import { Client, Project, TaskItem, TaskFile, CommentPin, DrawingLayer, DrawingDoc, Point, Stroke } from './types';
export type { Client, Project, TaskItem, TaskFile, CommentPin, DrawingLayer, DrawingDoc, Point, Stroke };
import { HeaderBar } from './components/HeaderBar';
import { KanbanBoard } from './components/KanbanBoard';
import { PenzignCanvas } from './components/PenzignCanvas';
import { BrandDNAInspiration } from './components/BrandDNAInspiration';
import { NewClientModal, NewProjectModal } from './components/Modals';

import WorkspaceHub from './components/WorkspaceHub';
import GoogleDriveHub from './components/GoogleDriveHub';

export function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);

  // Zign Collections Data State
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskFiles, setTaskFiles] = useState<TaskFile[]>([]);
  const [comments, setComments] = useState<CommentPin[]>([]);

  // Selection & Active Item State
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);

  // Modal States
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isWorkspaceHubOpen, setIsWorkspaceHubOpen] = useState(false);
  const [isDriveHubOpen, setIsDriveHubOpen] = useState(false);

  // Canvas Drawing State
  const [layers, setLayers] = useState<DrawingLayer[]>([
    { id: 'layer-1', name: 'Background / Rough', strokes: [], visible: true, opacity: 1.0 },
    { id: 'layer-2', name: 'Ink / Inking', strokes: [], visible: true, opacity: 1.0 }
  ]);
  const [activeLayerId, setActiveLayerId] = useState<string>('layer-2');
  const [currentColor, setCurrentColor] = useState<string>('#610061'); // Canon #610061 MAX ENTROPY
  const [brushSize, setBrushSize] = useState<number>(6);
  const [brushMode, setBrushMode] = useState<'draw' | 'erase' | 'pencil' | 'marker' | 'airbrush'>('draw');
  const [opacity, setOpacity] = useState<number>(1.0);
  const [pressureMultiplier, setPressureMultiplier] = useState<number>(2.0);

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 1. Subscribe to Clients
  useEffect(() => {
    if (!user) {
      setClients([
        {
          id: 'demo-client-1',
          ownerUserID: 'demo',
          companyName: 'Acme Creative Studio',
          contactName: 'Alice Johnson',
          brandDNA: 'Canon colors #610061 (MAX ENTROPY) and #FF0000 (MIN ENTROPY). Modern minimalist, high contrast, bold line art.'
        }
      ]);
      setSelectedClientId('demo-client-1');
      return;
    }

    const q = query(
      collection(db, 'clients'),
      where('ownerUserID', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Client[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Client);
      });
      setClients(list);
      if (list.length > 0 && !selectedClientId) {
        setSelectedClientId(list[0].id);
      }
    });

    return () => unsubscribe();
  }, [user, selectedClientId]);

  // 2. Subscribe to Projects
  useEffect(() => {
    if (!user) {
      setProjects([
        {
          id: 'demo-project-1',
          ownerUserID: 'demo',
          ownerClientID: 'demo-client-1',
          projectName: 'Penzign Studio Launch 2026',
          status: 'Active',
          brief: 'Create pressure-sensitive keyframe illustrations and design hero branding for Penzign launch.'
        }
      ]);
      setSelectedProjectId('demo-project-1');
      return;
    }

    const q = query(
      collection(db, 'projects'),
      where('ownerUserID', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Project[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Project);
      });
      setProjects(list);
      if (list.length > 0 && !selectedProjectId) {
        setSelectedProjectId(list[0].id);
      }
    });

    return () => unsubscribe();
  }, [user, selectedProjectId]);

  // 3. Subscribe to Tasks
  useEffect(() => {
    if (!user) {
      const initialTasks: TaskItem[] = [
        {
          id: 'demo-task-1',
          ownerUserID: 'demo',
          ownerProjectID: 'demo-project-1',
          taskName: 'Hero Logo & S Pen Sketch',
          status: 'In Progress'
        },
        {
          id: 'demo-task-2',
          ownerUserID: 'demo',
          ownerProjectID: 'demo-project-1',
          taskName: 'Brand Color Explorations',
          status: 'To Do'
        },
        {
          id: 'demo-task-3',
          ownerUserID: 'demo',
          ownerProjectID: 'demo-project-1',
          taskName: 'Kanban Layout Spec',
          status: 'Done'
        }
      ];
      setTasks(initialTasks);
      setActiveTask(initialTasks[0]);
      return;
    }

    const q = query(
      collection(db, 'tasks'),
      where('ownerUserID', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: TaskItem[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TaskItem);
      });
      setTasks(list);
      if (list.length > 0 && !activeTask) {
        setActiveTask(list[0]);
      }
    });

    return () => unsubscribe();
  }, [user, activeTask]);

  // 4. Subscribe to Real-Time Comments for Active Task (Pin Comments)
  useEffect(() => {
    if (!activeTask) {
      setComments([
        {
          id: 'demo-pin-1',
          ownerUserID: 'demo',
          ownerTaskID: 'demo-task-1',
          text: 'Increase entropy on this stroke (#610061)!',
          x: 45,
          y: 35,
          author: 'Lead Designer'
        }
      ]);
      return;
    }

    if (!user) return;

    const q = query(
      collection(db, 'comments'),
      where('ownerUserID', '==', user.uid),
      where('ownerTaskID', '==', activeTask.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: CommentPin[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as CommentPin);
      });
      setComments(list);
    });

    return () => unsubscribe();
  }, [user, activeTask]);

  // Handle Creating Client
  const handleCreateClient = async (companyName: string, contactName: string, brandDNA: string) => {
    if (!user) {
      const newClient: Client = {
        id: `demo-client-${Date.now()}`,
        ownerUserID: 'demo',
        companyName,
        contactName,
        brandDNA
      };
      setClients(prev => [...prev, newClient]);
      setSelectedClientId(newClient.id);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'clients'), {
        ownerUserID: user.uid,
        companyName,
        contactName,
        brandDNA,
        createdAt: new Date().toISOString()
      });
      setSelectedClientId(docRef.id);
    } catch (err: any) {
      alert(`Could not create client: ${err.message || err}`);
    }
  };

  // Handle Creating Project
  const handleCreateProject = async (clientId: string, projectName: string, brief: string) => {
    if (!user) {
      const newProj: Project = {
        id: `demo-project-${Date.now()}`,
        ownerUserID: 'demo',
        ownerClientID: clientId,
        projectName,
        status: 'Active',
        brief
      };
      setProjects(prev => [...prev, newProj]);
      setSelectedProjectId(newProj.id);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'projects'), {
        ownerUserID: user.uid,
        ownerClientID: clientId,
        projectName,
        status: 'Active',
        brief,
        createdAt: new Date().toISOString()
      });
      setSelectedProjectId(docRef.id);
    } catch (err: any) {
      alert(`Could not create project: ${err.message || err}`);
    }
  };

  // Handle Creating Task
  const handleCreateTask = async (taskName: string) => {
    const projId = selectedProjectId || (projects[0]?.id || 'default');
    if (!user) {
      const newTask: TaskItem = {
        id: `demo-task-${Date.now()}`,
        ownerUserID: 'demo',
        ownerProjectID: projId,
        taskName,
        status: 'To Do'
      };
      setTasks(prev => [...prev, newTask]);
      setActiveTask(newTask);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'tasks'), {
        ownerUserID: user.uid,
        ownerProjectID: projId,
        taskName,
        status: 'To Do',
        createdAt: new Date().toISOString()
      });
      const createdTask: TaskItem = {
        id: docRef.id,
        ownerUserID: user.uid,
        ownerProjectID: projId,
        taskName,
        status: 'To Do'
      };
      setActiveTask(createdTask);
    } catch (err: any) {
      alert(`Could not create task: ${err.message || err}`);
    }
  };

  // Update Task Status
  const handleUpdateTaskStatus = async (taskId: string, status: 'To Do' | 'In Progress' | 'Done') => {
    if (!user) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
      return;
    }

    try {
      await updateDoc(doc(db, 'tasks', taskId), { status });
    } catch (err: any) {
      alert(`Could not update task: ${err.message || err}`);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!user) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      if (activeTask?.id === taskId) {
        setActiveTask(tasks.find(t => t.id !== taskId) || null);
      }
      return;
    }

    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      if (activeTask?.id === taskId) {
        setActiveTask(null);
      }
    } catch (err: any) {
      alert(`Could not delete task: ${err.message || err}`);
    }
  };

  // Save Canvas Drawing to Firestore
  const handleSaveCanvas = async (dataUrl: string, strokesJson: string) => {
    if (!activeTask) return;

    if (!user) {
      console.log('Saved canvas locally in demo mode.');
      return;
    }

    try {
      // Save to drawings collection
      const drawingRef = await addDoc(collection(db, 'drawings'), {
        userId: user.uid,
        ownerUserID: user.uid,
        ownerTaskID: activeTask.id,
        title: `${activeTask.taskName} Sketch`,
        dataUrl,
        strokes: strokesJson,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Link file in files collection
      await addDoc(collection(db, 'files'), {
        ownerUserID: user.uid,
        ownerTaskID: activeTask.id,
        fileName: `${activeTask.taskName}.png`,
        fileURL: dataUrl,
        createdAt: new Date().toISOString()
      });

      // Update task's current drawing pointer
      await updateDoc(doc(db, 'tasks', activeTask.id), {
        currentDrawingId: drawingRef.id
      });
    } catch (err: any) {
      console.error('Error saving drawing:', err);
    }
  };

  // Add Comment Pin
  const handleAddCommentPin = async (text: string, x: number, y: number) => {
    if (!activeTask) return;

    const authorName = user?.displayName || user?.email?.split('@')[0] || 'Studio Artist';

    if (!user) {
      const newPin: CommentPin = {
        id: `demo-pin-${Date.now()}`,
        ownerUserID: 'demo',
        ownerTaskID: activeTask.id,
        text,
        x,
        y,
        author: authorName
      };
      setComments(prev => [...prev, newPin]);
      return;
    }

    try {
      await addDoc(collection(db, 'comments'), {
        ownerUserID: user.uid,
        ownerTaskID: activeTask.id,
        text,
        x,
        y,
        author: authorName,
        createdAt: new Date().toISOString()
      });
    } catch (err: any) {
      alert(`Could not post comment pin: ${err.message || err}`);
    }
  };

  // Layers Actions
  const handleAddLayer = () => {
    const newId = `layer-${Date.now()}`;
    const newLayer: DrawingLayer = {
      id: newId,
      name: `Layer ${layers.length + 1}`,
      strokes: [],
      visible: true,
      opacity: 1.0
    };
    setLayers(prev => [...prev, newLayer]);
    setActiveLayerId(newId);
  };

  const handleDeleteLayer = (layerId: string) => {
    if (layers.length <= 1) return;
    const filtered = layers.filter(l => l.id !== layerId);
    setLayers(filtered);
    if (activeLayerId === layerId) {
      setActiveLayerId(filtered[0].id);
    }
  };

  const handleToggleLayerVisibility = (layerId: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l));
  };

  const handleChangeLayerOpacity = (layerId: string, opacityVal: number) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, opacity: opacityVal } : l));
  };

  // Export Actions
  const handleExportPNG = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${activeTask?.taskName || 'Penzign-Sketch'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleExportJPG = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${activeTask?.taskName || 'Penzign-Sketch'}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  };

  const handleExportPDF = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(`${activeTask?.taskName || 'Penzign-Artwork'}.pdf`);
  };

  const activeClient = clients.find(c => c.id === selectedClientId) || clients[0] || null;
  const activeProject = projects.find(p => p.id === selectedProjectId) || projects[0] || null;

  return (
    <div className="w-screen h-screen flex flex-col bg-[#06080D] text-white overflow-hidden select-none font-mono">
      {/* Top Navigation Header Bar */}
      <HeaderBar
        user={user}
        clients={clients}
        projects={projects}
        selectedClientId={selectedClientId}
        selectedProjectId={selectedProjectId}
        onSelectClient={setSelectedClientId}
        onSelectProject={setSelectedProjectId}
        onOpenNewClientModal={() => setIsNewClientModalOpen(true)}
        onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
        onSignIn={signIn}
        onSignOut={signOut}
        onToggleInspirationModal={() => {}}
        onToggleWorkspaceModal={() => setIsWorkspaceHubOpen(true)}
        onToggleDriveModal={() => setIsDriveHubOpen(true)}
      />

      {/* Main Studio Three-Column Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden relative">
        {/* LEFT PANEL: Zign Kanban Navigation (3 cols) */}
        <div className="lg:col-span-3 h-full overflow-hidden border-r border-white/10">
          <KanbanBoard
            clients={clients}
            projects={projects}
            tasks={tasks}
            taskFiles={taskFiles}
            selectedClientId={selectedClientId}
            selectedProjectId={selectedProjectId}
            activeTaskId={activeTask?.id || null}
            onSelectClient={setSelectedClientId}
            onSelectProject={setSelectedProjectId}
            onSelectTask={setActiveTask}
            onCreateTask={handleCreateTask}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onDeleteTask={handleDeleteTask}
            onOpenNewClientModal={() => setIsNewClientModalOpen(true)}
            onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
          />
        </div>

        {/* CENTER PANEL: Penzign S Pen Pressure Canvas (6 cols) */}
        <div className="lg:col-span-6 h-full overflow-hidden relative">
          <PenzignCanvas
            activeTask={activeTask}
            layers={layers}
            activeLayerId={activeLayerId}
            currentColor={currentColor}
            brushSize={brushSize}
            brushMode={brushMode}
            opacity={opacity}
            pressureMultiplier={pressureMultiplier}
            comments={comments}
            onUpdateLayers={setLayers}
            onSaveCanvas={handleSaveCanvas}
            onAddCommentPin={handleAddCommentPin}
          />
        </div>

        {/* RIGHT PANEL: Brand DNA, Layers, AI Inspiration & Export (3 cols) */}
        <div className="lg:col-span-3 h-full overflow-hidden border-l border-white/10">
          <BrandDNAInspiration
            client={activeClient}
            project={activeProject}
            activeTask={activeTask}
            layers={layers}
            activeLayerId={activeLayerId}
            currentColor={currentColor}
            brushSize={brushSize}
            brushMode={brushMode}
            opacity={opacity}
            pressureMultiplier={pressureMultiplier}
            onSelectColor={setCurrentColor}
            onChangeBrushSize={setBrushSize}
            onChangeBrushMode={setBrushMode}
            onChangeOpacity={setOpacity}
            onChangePressureMultiplier={setPressureMultiplier}
            onSelectLayer={setActiveLayerId}
            onAddLayer={handleAddLayer}
            onDeleteLayer={handleDeleteLayer}
            onToggleLayerVisibility={handleToggleLayerVisibility}
            onChangeLayerOpacity={handleChangeLayerOpacity}
            onUpdateClientBrandDNA={(dna) => {
              if (activeClient) {
                setClients(prev => prev.map(c => c.id === activeClient.id ? { ...c, brandDNA: dna } : c));
              }
            }}
            onExportPNG={handleExportPNG}
            onExportJPG={handleExportJPG}
            onExportPDF={handleExportPDF}
          />
        </div>
      </div>

      {/* Modals for Client & Project Creation */}
      <NewClientModal
        isOpen={isNewClientModalOpen}
        onClose={() => setIsNewClientModalOpen(false)}
        onCreateClient={handleCreateClient}
      />

      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        clients={clients}
        selectedClientId={selectedClientId}
        onClose={() => setIsNewProjectModalOpen(false)}
        onCreateProject={handleCreateProject}
      />

      {/* Workspace Hub Integration */}
      <WorkspaceHub
        isOpen={isWorkspaceHubOpen}
        onClose={() => setIsWorkspaceHubOpen(false)}
        user={user}
        driveToken={null}
        activeDataUrl=""
      />
    </div>
  );
}

export default App;
