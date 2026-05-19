import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Pencil, 
  Eraser, 
  RotateCcw, 
  Trash2, 
  Download, 
  Undo, 
  Redo,
  Circle,
  Settings2,
  Maximize2,
  Minimize2,
  Save,
  Grid2X2,
  X,
  Sparkles,
  User as UserIcon,
  LogOut,
  ChevronRight,
  Plus,
  Pipette
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, signIn, signOut } from './firebase';

// --- Types ---

interface Point {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
  mode: 'draw' | 'erase';
}

interface Drawing {
  id: string;
  userId: string;
  title: string;
  dataUrl: string;
  strokes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const COLORS = [
  '#000000', // Black
  '#E63946', // Imperial Red
  '#457B9D', // Celadon Blue
  '#FFB703', // Orange Yellow
  '#06D6A0', // Zomp Green
  '#7209B7', // Grape Purple
  '#FFFFFF', // White
];

// --- Helper Functions ---

const getPseudoPressure = (event: React.PointerEvent | PointerEvent) => {
  return event.pressure > 0 ? event.pressure : 0.5;
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // App State
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGallery, setShowGallery] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Canvas State
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [history, setHistory] = useState<Stroke[]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  
  // Tool State
  const [color, setColor] = useState(COLORS[0]);
  const [baseWidth, setBaseWidth] = useState(8);
  const [mode, setMode] = useState<'draw' | 'erase'>('draw');
  const [showToolbar, setShowToolbar] = useState(true);
  const [backgroundType, setBackgroundType] = useState<'none' | 'dots' | 'grid' | 'lines'>('dots');
  const [penOnly, setPenOnly] = useState(false);

  // Gemini State
  const [aiInspiration, setAiInspiration] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [selectedDrawingForAi, setSelectedDrawingForAi] = useState<Drawing | null>(null);

  const colorInputRef = useRef<HTMLInputElement>(null);

  // --- Auth & Subscription ---

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setDrawings([]);
      return;
    }

    const q = query(
      collection(db, 'drawings'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Drawing));
      setDrawings(docs);
    });

    return unsubscribe;
  }, [user]);

  // --- Canvas Logic ---

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { desynchronized: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawStroke = (stroke: Stroke) => {
      if (stroke.points.length < 1) return;
      ctx.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = stroke.mode === 'erase' ? 'rgba(0,0,0,1)' : stroke.color;

      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, (stroke.width * p.pressure) / 2, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        const p2 = stroke.points[i];
        ctx.lineWidth = stroke.width * p2.pressure;
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
      }
    };

    history.forEach(drawStroke);
    if (isDrawing && currentStroke.length > 0) {
      drawStroke({ points: currentStroke, color, width: baseWidth, mode });
    }
  }, [history, currentStroke, isDrawing, color, baseWidth, mode]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const { width, height } = container.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;
    redraw();
  }, [redraw]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // --- Pointer Events ---

  const handlePointerDown = (e: React.PointerEvent) => {
    if (showGallery) return;
    if (penOnly && e.pointerType !== 'pen') return;
    e.preventDefault();
    setIsDrawing(true);
    setRedoStack([]);
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentStroke([{ x, y, pressure: getPseudoPressure(e), timestamp: Date.now() }]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentStroke(prev => [...prev, { x, y, pressure: getPseudoPressure(e), timestamp: Date.now() }]);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 0) {
      setHistory(prev => [...prev, { points: currentStroke, color, width: baseWidth, mode }]);
    }
    setCurrentStroke([]);
  };

  // --- Actions ---

  const undo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, last]);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setHistory(prev => [...prev, last]);
  };

  const clear = () => {
    // Check if there is anything to clear first
    if (history.length === 0) return;
    
    if (window.confirm('Clear your current workspace? This action cannot be undone.')) {
      setHistory([]);
      setRedoStack([]);
      // Reset modes
      setMode('draw');
      setAiInspiration(null);
    }
  };

  const saveToGallery = async () => {
    if (!user) {
      signIn();
      return;
    }
    if (history.length === 0) return;
    
    setIsSaving(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Extract high-quality thumbnail
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        tCtx.fillStyle = '#FFFFFF';
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tCtx.drawImage(canvas, 0, 0);
      }

      const dataUrl = tempCanvas.toDataURL('image/png', 0.8);
      
      await addDoc(collection(db, 'drawings'), {
        userId: user.uid,
        title: `Sketch ${new Date().toLocaleDateString()}`,
        dataUrl,
        strokes: JSON.stringify(history),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      alert('Saved to gallery!');
    } catch (err) {
      console.error(err);
      alert('Failed to save.');
    } finally {
      setIsSaving(false);
    }
  };

  const getAiInspiration = async (drawing: Drawing) => {
    setIsAiProcessing(true);
    setAiInspiration(null);
    try {
      const res = await fetch('/api/gemini/inspire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageData: drawing.dataUrl,
          prompt: aiPrompt || "Analyze this drawing and provide 3 creative suggestions for how to advance or remix it. Be inspiring and concise."
        })
      });
      const data = await res.json();
      setAiInspiration(data.text);
    } catch (err) {
      console.error(err);
      setAiInspiration("Failed to get AI ideas. Try again.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const loadFromGallery = (drawing: Drawing) => {
    if (drawing.strokes) {
      setHistory(JSON.parse(drawing.strokes));
      setRedoStack([]);
      setShowGallery(false);
    }
  };

  const deleteDrawing = async (id: string) => {
    if (window.confirm('Delete this masterpiece?')) {
      await deleteDoc(doc(db, 'drawings', id));
    }
  };

  if (loading) return null;

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-screen bg-[#F5F5F0] overflow-hidden select-none touch-none font-sans`}
    >
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ 
          backgroundImage: backgroundType === 'dots' 
            ? 'radial-gradient(#000 1px, transparent 1px)' 
            : backgroundType === 'grid' 
              ? 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)'
              : backgroundType === 'lines'
                ? 'linear-gradient(#000 1px, transparent 1px)'
                : 'none',
          backgroundSize: '24px 24px' 
        }}
      />

      <canvas
        ref={canvasRef}
        className={`block touch-none ${mode === 'erase' ? 'cursor-crosshair' : 'active:cursor-none'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Auth Indicator */}
      <div className="absolute top-6 left-6 z-40 flex items-center gap-3">
        {user ? (
          <div className="group relative">
            <button className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur rounded-full border border-black/10 shadow-sm hover:bg-white transition-all">
              <img src={user.photoURL || ''} className="w-6 h-6 rounded-full border border-black/10" alt="avatar" />
              <span className="text-[10px] font-bold uppercase tracking-tight max-w-[80px] truncate">{user.displayName}</span>
            </button>
            <div className="absolute top-full left-0 mt-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity">
              <button onClick={signOut} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-[10px] uppercase font-bold hover:bg-zinc-800">
                <LogOut size={12} /> Sign Out
              </button>
            </div>
          </div>
        ) : (
          <button onClick={signIn} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-[10px] uppercase font-bold shadow-lg hover:scale-105 transition-transform active:scale-95">
            <UserIcon size={14} /> Connect Account
          </button>
        )}
      </div>

      {/* Toolbar */}
      <AnimatePresence>
        {showToolbar && !showGallery && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-white/90 backdrop-blur-md border border-black/10 rounded-full shadow-2xl z-50 flex-wrap justify-center min-w-[320px]"
          >
            <div className="flex items-center gap-1 border-r border-black/10 pr-3">
              <ToolButton active={mode === 'draw'} onClick={() => setMode('draw')} icon={<Pencil size={18} />} label="Pen" />
              <ToolButton active={mode === 'erase'} onClick={() => setMode('erase')} icon={<Eraser size={18} />} label="Eraser" />
              <ToolButton active={penOnly} onClick={() => setPenOnly(!penOnly)} icon={<Plus size={18} className={penOnly ? 'rotate-45' : ''} />} label="Stylus Lock" />
            </div>

            <div className="flex items-center gap-1.5 border-r border-black/10 pr-3">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setMode('draw'); }}
                  className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 active:scale-95 ${color === c && mode === 'draw' ? 'border-black scale-110 shadow-lg' : 'border-black/5'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div className="w-px h-4 bg-black/5 mx-0.5" />
              <button
                onClick={() => colorInputRef.current?.click()}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${!COLORS.includes(color) && mode === 'draw' ? 'border-black scale-110 shadow-lg' : 'border-black/5 bg-zinc-100'}`}
                style={{ backgroundColor: !COLORS.includes(color) ? color : undefined }}
              >
                {!COLORS.includes(color) ? null : <Pipette size={12} className="opacity-40" />}
                <input 
                  ref={colorInputRef}
                  type="color" 
                  className="sr-only" 
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value);
                    setMode('draw');
                  }}
                />
              </button>
            </div>

            <div className="flex items-center gap-3 border-r border-black/10 pr-3">
              <div className="flex items-center gap-1.5 mr-2">
                {[2, 8, 24].map(size => (
                  <button
                    key={size}
                    onClick={() => setBaseWidth(size)}
                    className={`flex items-center justify-center rounded-full transition-all ${baseWidth === size ? 'bg-black text-white' : 'hover:bg-black/5'}`}
                    style={{ width: 28, height: 28 }}
                  >
                    <div 
                      className="rounded-full bg-current" 
                      style={{ 
                        width: Math.max(2, size / 2.5), 
                        height: Math.max(2, size / 2.5) 
                      }} 
                    />
                  </button>
                ))}
              </div>
              <input type="range" min="1" max="100" value={baseWidth} onChange={(e) => setBaseWidth(parseInt(e.target.value))} className="w-16 h-1 bg-black/10 rounded-lg appearance-none cursor-pointer accent-black" />
            </div>

            <div className="flex items-center gap-1">
              <ActionButton onClick={undo} disabled={history.length === 0} icon={<Undo size={16} />} />
              <ActionButton onClick={redo} disabled={redoStack.length === 0} icon={<Redo size={16} />} />
              <ActionButton onClick={clear} icon={<Trash2 size={16} />} />
              <ActionButton onClick={saveToGallery} icon={<Save size={16} className={isSaving ? 'animate-pulse' : ''} />} />
              <div className="w-px h-4 bg-black/10 mx-1" />
              <button 
                onClick={() => setBackgroundType(prev => 
                  prev === 'none' ? 'dots' : prev === 'dots' ? 'grid' : prev === 'grid' ? 'lines' : 'none'
                )}
                className="p-2 rounded-xl hover:bg-black/5 opacity-40 uppercase text-[8px] font-bold tracking-tighter"
              >
                {backgroundType || 'BG'}
              </button>
              <ActionButton onClick={() => setShowGallery(true)} icon={<Grid2X2 size={16} />} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gallery Overlay */}
      <AnimatePresence>
        {showGallery && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="absolute inset-0 bg-white z-[100] overflow-y-auto px-6 py-12 md:px-20"
          >
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-8">
                <div>
                  <h2 className="text-4xl font-bold tracking-tighter uppercase italic">Studio Gallery</h2>
                  <p className="text-xs font-mono opacity-40 uppercase tracking-widest">{drawings.length} SAVED MASTERPIECES</p>
                </div>

                <div className="flex-1 max-w-md">
                  <div className="flex items-center gap-3 px-4 py-2 bg-black/5 rounded-2xl border border-black/5 focus-within:border-black/20 transition-colors">
                    <Sparkles size={16} className="text-black/30" />
                    <input 
                      type="text" 
                      placeholder="Ask the AI (e.g. 'How can I make this more surreal?')"
                      className="bg-transparent border-none outline-none text-xs w-full py-1"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                    />
                  </div>
                  <p className="text-[9px] font-mono opacity-30 mt-2 uppercase tracking-wide">GEMINI CONTEXT PRESET</p>
                </div>

                <button onClick={() => setShowGallery(false)} className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform active:scale-90 shadow-xl self-end md:self-center">
                  <X />
                </button>
              </div>

              {drawings.length === 0 ? (
                <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-black/5 rounded-3xl opacity-20">
                  <Plus size={48} />
                  <p className="mt-4 font-bold uppercase tracking-widest text-sm">Your gallery is empty</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-32">
                  {drawings.map(d => (
                    <GalleryCard 
                      key={d.id} 
                      drawing={d} 
                      onLoad={() => loadFromGallery(d)} 
                      onDelete={() => deleteDrawing(d.id)}
                      onAi={() => getAiInspiration(d)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Inspiration Drawer */}
      <AnimatePresence>
        {(aiInspiration || isAiProcessing) && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="absolute bottom-0 inset-x-0 bg-black text-white p-8 md:p-12 z-[110] rounded-t-[40px] shadow-[0_-20px_50px_rgba(0,0,0,0.3)] max-h-[80vh] overflow-y-auto"
          >
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-neon-green">
                    <Sparkles size={20} className={isAiProcessing ? 'animate-spin' : ''} />
                  </div>
                  <h3 className="font-bold uppercase tracking-widest text-sm">Gemini Design Intelligence</h3>
                </div>
                <button onClick={() => setAiInspiration(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              {isAiProcessing ? (
                <div className="space-y-4">
                  <div className="h-4 bg-white/5 rounded-full w-full animate-pulse" />
                  <div className="h-4 bg-white/5 rounded-full w-3/4 animate-pulse" />
                  <div className="h-4 bg-white/5 rounded-full w-1/2 animate-pulse" />
                </div>
              ) : (
                <div className="prose prose-invert max-w-none text-zinc-300 font-medium leading-relaxed">
                  {aiInspiration?.split('\n').map((line, i) => (
                    <p key={i} className="mb-4">{line}</p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toolbar Toggle */}
      {!showGallery && (
        <button
          onClick={() => setShowToolbar(!showToolbar)}
          className="absolute top-6 right-6 w-10 h-10 bg-white/80 backdrop-blur border border-black/10 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 z-50 hover:bg-white"
        >
          <RotateCcw size={18} className={`transition-transform duration-500 ${showToolbar ? 'rotate-180' : 'rotate-0'}`} />
        </button>
      )}

      {/* Overlay Status */}
      {!showGallery && (
        <div className="absolute top-6 left-24 flex flex-col gap-0.5 pointer-events-none opacity-30">
          <h1 className="text-[10px] font-black tracking-tighter uppercase italic">S Pen Draw Pro</h1>
          <p className="text-[8px] font-mono uppercase tracking-[0.2em]">
            {history.length} STROKES • {mode.toUpperCase()}
          </p>
        </div>
      )}
    </div>
  );
}

// --- Components ---

interface GalleryCardProps {
  key?: string | number;
  drawing: Drawing;
  onLoad: () => void;
  onDelete: () => void;
  onAi: () => void;
}

function GalleryCard({ drawing, onLoad, onDelete, onAi }: GalleryCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -8 }}
      className="group bg-[#F9F9F7] border border-black/5 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all"
    >
      <div className="aspect-[4/3] relative bg-white overflow-hidden p-4">
        <img 
          src={drawing.dataUrl} 
          className="w-full h-full object-contain drop-shadow-md transition-transform duration-500 group-hover:scale-105" 
          alt={drawing.title} 
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
          <button 
            onClick={(e) => { e.stopPropagation(); onLoad(); }}
            className="px-6 py-2 bg-white text-black rounded-full font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
          >
            Load <ChevronRight size={14} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onAi(); }}
            className="px-6 py-2 bg-black text-white rounded-full font-bold uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-zinc-800 transition-colors"
          >
            <Sparkles size={14} className="text-neon-green" /> V-ANALYSIS
          </button>
        </div>
      </div>
      <div className="p-5 flex items-center justify-between">
        <div>
          <h4 className="font-bold text-xs uppercase tracking-tight truncate max-w-[150px]">{drawing.title}</h4>
          <p className="text-[10px] font-mono opacity-30 mt-1">
            {drawing.createdAt?.toDate().toLocaleDateString() || 'Just now'}
          </p>
        </div>
        <button onClick={onDelete} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors">
          <Trash2 size={16} />
        </button>
      </div>
    </motion.div>
  );
}

function ToolButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-xl flex flex-col items-center transition-all ${active ? 'bg-black text-white shadow-lg' : 'hover:bg-black/5 opacity-40'}`}
      title={label}
    >
      {icon}
    </button>
  );
}

function ActionButton({ onClick, disabled, icon }: { onClick: () => void; disabled?: boolean; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-2 rounded-xl hover:bg-black/5 disabled:opacity-10 disabled:cursor-not-allowed transition-colors"
    >
      {icon}
    </button>
  );
}
