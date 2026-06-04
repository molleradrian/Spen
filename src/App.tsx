import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
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
  Pipette,
  Layers,
  Eye,
  EyeOff,
  Trash,
  Home,
  Settings,
  Clock,
  Palette,
  Sliders,
  Hand,
  Copy,
  Check,
  Loader2,
  Cloud,
  Briefcase
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
import { db, auth, signIn, signOut, getAccessToken, setAccessToken } from './firebase';
import LandingPage from './components/LandingPage';
import GoogleDriveHub from './components/GoogleDriveHub';
import WorkspaceHub from './components/WorkspaceHub';
import CanvasStats from './components/CanvasStats';
import AndroidDevHub from './components/AndroidDevHub';
import { Smartphone } from 'lucide-react';

// --- Types ---

export interface Point {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
  mode: 'draw' | 'erase';
}

export interface DrawingLayer {
  id: string;
  name: string;
  strokes: Stroke[];
  visible: boolean;
  opacity: number;
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

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

const rgbToHex = (r: number, g: number, b: number): string => {
  const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val)));
  return "#" + ((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1).toUpperCase();
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // App State
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLanding, setShowLanding] = useState(true);
  const [showGallery, setShowGallery] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [testPressure, setTestPressure] = useState(0.5);
  const [pressureHistory, setPressureHistory] = useState<number[]>([]);
  const [isTestingPressure, setIsTestingPressure] = useState(false);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [pdfExportStatus, setPdfExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');

  // Google Drive & Picker state
  const [showDriveHub, setShowDriveHub] = useState(false);
  const [showWorkspaceHub, setShowWorkspaceHub] = useState(false);
  const [showAndroidDevHub, setShowAndroidDevHub] = useState(false);
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [loadedDriveFileId, setLoadedDriveFileId] = useState<string | null>(null);
  const [loadedDriveFileName, setLoadedDriveFileName] = useState<string | null>(null);
  const [canvasBackgroundImage, setCanvasBackgroundImage] = useState<string | null>(null);
  
  // Canvas State
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [workspaceSessionId, setWorkspaceSessionId] = useState<string>(() => Date.now().toString());
  const [layers, setLayers] = useState<DrawingLayer[]>([
    { id: 'layer-1', name: 'Background', strokes: [], visible: true, opacity: 1 }
  ]);
  const [activeLayerId, setActiveLayerId] = useState('layer-1');
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  
  // Tool State
  const [color, setColor] = useState(COLORS[0]);
  const [colorChangerExpanded, setColorChangerExpanded] = useState(false);
  const [baseWidth, setBaseWidth] = useState(8);
  const [mode, setMode] = useState<'draw' | 'erase'>('draw');
  const [showToolbar, setShowToolbar] = useState(true);
  const [backgroundType, setBackgroundType] = useState<'none' | 'dots' | 'grid' | 'lines'>('dots');
  const [penOnly, setPenOnly] = useState(() => {
    try {
      const focusVal = localStorage.getItem('s_pen_focus_mode');
      if (focusVal) return focusVal === 'pen';
      const val = localStorage.getItem('s_pen_allow_touch');
      return val ? JSON.parse(val) === false : false;
    } catch {
      return false;
    }
  });

  // Focus Mode State: Switching between 'touch' (finger and mouse) and 'pen' (active stylus/S Pen drawing only)
  const [focusMode, setFocusMode] = useState<'touch' | 'pen'>(() => {
    try {
      const val = localStorage.getItem('s_pen_focus_mode');
      if (val === 'pen' || val === 'touch') return val;
      const legacyTouch = localStorage.getItem('s_pen_allow_touch');
      return (legacyTouch && JSON.parse(legacyTouch) === false) ? 'pen' : 'touch';
    } catch {
      return 'touch';
    }
  });

  // Input Filtering for Finger Touch, Mouse, and Generic Pens
  const [allowPen, setAllowPen] = useState(() => {
    try {
      const val = localStorage.getItem('s_pen_allow_pen');
      return val ? JSON.parse(val) : true;
    } catch {
      return true;
    }
  });
  const [allowTouch, setAllowTouch] = useState(() => {
    try {
      const val = localStorage.getItem('s_pen_allow_touch');
      return val ? JSON.parse(val) : true;
    } catch {
      return true;
    }
  });
  const [allowMouse, setAllowMouse] = useState(() => {
    try {
      const val = localStorage.getItem('s_pen_allow_mouse');
      return val ? JSON.parse(val) : true;
    } catch {
      return true;
    }
  });

  const [simulationMode, setSimulationMode] = useState<'constant' | 'velocity'>(() => {
    try {
      const val = localStorage.getItem('s_pen_simulation_mode');
      return val ? (val as 'constant' | 'velocity') : 'velocity';
    } catch {
      return 'velocity';
    }
  });

  const [constantPressureMultiplier, setConstantPressureMultiplier] = useState(() => {
    try {
      const val = localStorage.getItem('s_pen_constant_pressure_multiplier');
      return val ? parseFloat(val) : 0.5;
    } catch {
      return 0.5;
    }
  });

  // Flutter draw code simulation state
  const [flutterMultiplier, setFlutterMultiplier] = useState(3.0);
  const [isCopied, setIsCopied] = useState(false);

  const copyFlutterCode = useCallback(() => {
    const code = `void onPanUpdate(GestureDragUpdateDetails details) {
  // Access hardware input pressure from touch/pencil
  double pressure = details.pressure ?? 1.0;
  
  // Dynamically scale strokeWidth of Paint object based on pressure
  double strokeWidth = ${flutterMultiplier.toFixed(1)} * pressure;
  
  setState(() {
    points.add(DrawingPoint(
      point: details.localPosition,
      paint: Paint()
        ..color = activeColor
        ..strokeCap = StrokeCap.round
        ..strokeWidth = strokeWidth,
    ));
  });
}`;
    try {
      navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  }, [flutterMultiplier]);

  // Explicit focus mode toggler with physical S-Pen palm rejection sync
  const setFocusModeExplicit = useCallback((newMode: 'touch' | 'pen') => {
    setFocusMode(newMode);
    const isPenFocus = newMode === 'pen';
    setPenOnly(isPenFocus);
    setAllowPen(true);
    setAllowTouch(!isPenFocus);
    setAllowMouse(!isPenFocus);
    try {
      localStorage.setItem('s_pen_focus_mode', newMode);
      localStorage.setItem('s_pen_allow_pen', 'true');
      localStorage.setItem('s_pen_allow_touch', JSON.stringify(!isPenFocus));
      localStorage.setItem('s_pen_allow_mouse', JSON.stringify(!isPenFocus));
    } catch {}
  }, []);

  const toggleFocusMode = useCallback(() => {
    const nextVal = focusMode === 'touch' ? 'pen' : 'touch';
    setFocusModeExplicit(nextVal);
  }, [focusMode, setFocusModeExplicit]);

  const toggleStylusLock = () => {
    toggleFocusMode();
  };

  // Pressure Sensitivity Mapping Config
  const [pressureOffset, setPressureOffset] = useState(() => {
    try {
      const val = localStorage.getItem('s_pen_pressure_offset');
      return val ? parseFloat(val) : 1.0;
    } catch {
      return 1.0;
    }
  });
  const [pressureScale, setPressureScale] = useState(() => {
    try {
      const val = localStorage.getItem('s_pen_pressure_scale');
      return val ? parseFloat(val) : 5.0; // Defaults to 1.0 + 5.0 * pressure style
    } catch {
      return 5.0;
    }
  });
  const [useRawCustomFormula, setUseRawCustomFormula] = useState(() => {
    try {
      const val = localStorage.getItem('s_pen_use_raw_formula');
      return val ? JSON.parse(val) : true;
    } catch {
      return true;
    }
  });

  // Gemini State
  const [aiInspiration, setAiInspiration] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [selectedDrawingForAi, setSelectedDrawingForAi] = useState<Drawing | null>(null);
  const [showLayers, setShowLayers] = useState(false);

  // Custom Color Studio State
  const [showColorStudio, setShowColorStudio] = useState(false);
  const [customSwatches, setCustomSwatches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('s_pen_custom_swatches');
      return saved ? JSON.parse(saved) : ['#06D6A0', '#457B9D', '#E63946', '#FFB703', '#7209B7'];
    } catch {
      return ['#06D6A0', '#457B9D', '#E63946', '#FFB703', '#7209B7'];
    }
  });

  const rgb = useMemo(() => hexToRgb(color), [color]);

  const pressureBins = useMemo(() => {
    const bins = new Array(10).fill(0);
    if (pressureHistory.length === 0) return bins;
    for (const p of pressureHistory) {
      const clamped = Math.max(0, Math.min(1, p));
      const binIdx = Math.min(9, Math.floor(clamped * 10));
      bins[binIdx]++;
    }
    return bins;
  }, [pressureHistory]);

  const activePressure = isTestingPressure ? testPressure : (currentStroke.length > 0 ? currentStroke[currentStroke.length - 1].pressure : 0);
  const liveActive = isTestingPressure || isDrawing;

  const handleRgbChange = (channel: 'r' | 'g' | 'b', value: number) => {
    const newRgb = { ...rgb, [channel]: value };
    const nextHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    setColor(nextHex);
    setMode('draw');
  };

  const addCurrentColorToSwatches = () => {
    if (customSwatches.includes(color)) return;
    const updated = [color, ...customSwatches.slice(0, 11)]; // limit to last 12 custom swatches
    setCustomSwatches(updated);
    try {
      localStorage.setItem('s_pen_custom_swatches', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const removeSwatch = (swatchColor: string) => {
    const updated = customSwatches.filter(s => s !== swatchColor);
    setCustomSwatches(updated);
    try {
      localStorage.setItem('s_pen_custom_swatches', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const colorInputRef = useRef<HTMLInputElement>(null);

  // --- Auth & Subscription ---

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        const token = await getAccessToken();
        if (token) setDriveToken(token);
      } else {
        setDriveToken(null);
      }
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
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'drawings');
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

    const drawStroke = (stroke: Stroke, layerOpacity: number = 1) => {
      if (stroke.points.length < 1) return;
      ctx.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over';
      
      // Handle color with layer opacity
      if (stroke.mode !== 'erase') {
        ctx.globalAlpha = layerOpacity;
        ctx.strokeStyle = stroke.color;
      } else {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      }

      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        ctx.beginPath();
        const strokeWidth = useRawCustomFormula 
          ? (pressureOffset + pressureScale * p.pressure)
          : stroke.width * (pressureOffset + pressureScale * p.pressure);
        ctx.arc(p.x, p.y, strokeWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        const p2 = stroke.points[i];
        const strokeWidth = useRawCustomFormula 
          ? (pressureOffset + pressureScale * p2.pressure)
          : stroke.width * (pressureOffset + pressureScale * p2.pressure);
        ctx.lineWidth = strokeWidth;
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
      }
      ctx.globalAlpha = 1; // Reset
    };

    layers.forEach(layer => {
      if (!layer.visible) return;
      layer.strokes.forEach(s => drawStroke(s, layer.opacity));
      
      // Draw preview for current stroke if this is the active layer
      if (layer.id === activeLayerId && isDrawing && currentStroke.length > 0) {
        drawStroke({ points: currentStroke, color, width: baseWidth, mode }, layer.opacity);
      }
    });

  }, [layers, activeLayerId, currentStroke, isDrawing, color, baseWidth, mode, pressureOffset, pressureScale, useRawCustomFormula]);

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

  const testLastPointRef = useRef<{ x: number; y: number; timestamp: number } | null>(null);

  const getPointerPressure = (e: React.PointerEvent, customPrevPoints?: Point[]) => {
    // If it's a pen and has native pressure, use it
    if (e.pointerType === 'pen' && e.pressure > 0) {
      return e.pressure;
    }

    if (simulationMode === 'velocity') {
      const activePoints = customPrevPoints !== undefined ? customPrevPoints : currentStroke;
      if (activePoints.length > 0) {
        const lastPoint = activePoints[activePoints.length - 1];
        const rect = canvasRef.current!.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        const currentT = Date.now();

        const dx = currentX - lastPoint.x;
        const dy = currentY - lastPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const dt = Math.max(1, currentT - lastPoint.timestamp);

        const speed = distance / dt; // pixels per ms

        // Map speed to pressure range: slower drawing = thicker stroke, faster drawing = thinner stroke
        const maxSpeed = 3.5;
        const minPressure = 0.15;
        const maxPressure = 1.0;
        const ratio = Math.min(1, speed / maxSpeed);
        
        return maxPressure - (maxPressure - minPressure) * ratio;
      }
    }

    return constantPressureMultiplier;
  };

  const isAllowedInput = (pointerType: string) => {
    if (focusMode === 'pen') {
      return pointerType === 'pen';
    } else {
      return pointerType === 'touch' || pointerType === 'mouse';
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (showGallery || showDashboard) return;
    if (!isAllowedInput(e.pointerType)) return;
    e.preventDefault();
    setColorChangerExpanded(false);
    setIsDrawing(true);
    setRedoStack([]);
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressureVal = getPointerPressure(e, []);
    setCurrentStroke([{ x, y, pressure: pressureVal, timestamp: Date.now() }]);
    setPressureHistory(prev => {
      const next = [...prev, pressureVal];
      return next.length > 2000 ? next.slice(next.length - 2000) : next;
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    if (!isAllowedInput(e.pointerType)) return;
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressureVal = getPointerPressure(e);
    setCurrentStroke(prev => [...prev, { x, y, pressure: pressureVal, timestamp: Date.now() }]);
    setPressureHistory(prev => {
      const next = [...prev, pressureVal];
      return next.length > 2000 ? next.slice(next.length - 2000) : next;
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 0) {
      setLayers(prev => prev.map(layer => {
        if (layer.id === activeLayerId) {
          return {
            ...layer,
            strokes: [...layer.strokes, { points: currentStroke, color, width: baseWidth, mode }]
          };
        }
        return layer;
      }));
    }
    setCurrentStroke([]);
  };

  const handleTestPointerMove = (e: React.PointerEvent) => {
    if (!isAllowedInput(e.pointerType)) return;
    
    let pressure = constantPressureMultiplier;
    if (e.pointerType === 'pen' && e.pressure > 0) {
      pressure = e.pressure;
    } else if (simulationMode === 'velocity') {
      const parentRect = e.currentTarget.getBoundingClientRect();
      const currentX = e.clientX - parentRect.left;
      const currentY = e.clientY - parentRect.top;
      const currentT = Date.now();
      
      if (testLastPointRef.current) {
        const last = testLastPointRef.current;
        const dx = currentX - last.x;
        const dy = currentY - last.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const dt = Math.max(1, currentT - last.timestamp);
        const speed = distance / dt;
        
        const maxSpeed = 3.5;
        const minPressure = 0.15;
        const maxPressure = 1.0;
        const ratio = Math.min(1, speed / maxSpeed);
        pressure = maxPressure - (maxPressure - minPressure) * ratio;
      }
      testLastPointRef.current = { x: currentX, y: currentY, timestamp: currentT };
    }

    if (e.buttons > 0) {
      setTestPressure(pressure);
      setIsTestingPressure(true);
      setPressureHistory(prev => {
        const next = [...prev, pressure];
        return next.length > 2000 ? next.slice(next.length - 2000) : next;
      });
    } else if (e.pointerType === 'pen') {
      setTestPressure(pressure);
    }
  };

  const handleTestPointerUp = () => {
    setIsTestingPressure(false);
    testLastPointRef.current = null;
  };

  // --- Actions ---

  const undo = () => {
    setLayers(prev => prev.map(layer => {
      if (layer.id === activeLayerId) {
        if (layer.strokes.length === 0) return layer;
        const last = layer.strokes[layer.strokes.length - 1];
        setRedoStack(r => [...r, last]);
        return {
          ...layer,
          strokes: layer.strokes.slice(0, -1)
        };
      }
      return layer;
    }));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setRedoStack(r => r.slice(0, -1));
    setLayers(prev => prev.map(layer => {
      if (layer.id === activeLayerId) {
        return {
          ...layer,
          strokes: [...layer.strokes, last]
        };
      }
      return layer;
    }));
  };

  const clear = () => {
    const hasStrokes = layers.some(l => l.strokes.length > 0);
    if (!hasStrokes) return;
    
    if (window.confirm('Clear your current workspace? This action cannot be undone.')) {
      setLayers(prev => prev.map(l => ({ ...l, strokes: [] })));
      setRedoStack([]);
      setMode('draw');
      setAiInspiration(null);
      setWorkspaceSessionId(Date.now().toString());
    }
  };

  const saveToGallery = async () => {
    if (!user) {
      signIn();
      return;
    }
    const hasStrokes = layers.some(l => l.strokes.length > 0);
    if (!hasStrokes) return;
    
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 4000);
        return;
      }

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
      
      try {
        await addDoc(collection(db, 'drawings'), {
          userId: user.uid,
          title: `Sketch ${new Date().toLocaleDateString()}`,
          dataUrl,
          strokes: JSON.stringify(layers),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (firestoreErr) {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 4000);
        handleFirestoreError(firestoreErr, OperationType.CREATE, 'drawings');
        return;
      }

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const exportToPdf = async () => {
    setPdfExportStatus('exporting');
    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        setPdfExportStatus('error');
        setTimeout(() => setPdfExportStatus('idle'), 3000);
        return;
      }

      const dataUrl = getCanvasDataUrl();
      if (!dataUrl) {
        setPdfExportStatus('error');
        setTimeout(() => setPdfExportStatus('idle'), 3000);
        return;
      }

      // Capture exact canvas dimensions
      const width = canvas.width;
      const height = canvas.height;
      const orientation = width > height ? 'landscape' : 'portrait';

      // Initialize jsPDF with matching canvas dimensions for pixel-perfect scaling
      const doc = new jsPDF({
        orientation: orientation,
        unit: 'px',
        format: [width, height],
        compress: true
      });

      // Render the PNG image onto the PDF page
      doc.addImage(dataUrl, 'PNG', 0, 0, width, height, undefined, 'FAST');

      // Descriptive PDF file name with date timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `SPenDraw_Workspace_${timestamp}.pdf`;

      doc.save(fileName);
      setPdfExportStatus('success');
      setTimeout(() => setPdfExportStatus('idle'), 3000);
    } catch (err) {
      console.error('PDF Export Error:', err);
      setPdfExportStatus('error');
      setTimeout(() => setPdfExportStatus('idle'), 3000);
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
      if (!res.ok) {
        throw new Error(data.error || "The API is currently busy. Please try again.");
      }
      setAiInspiration(data.text);
    } catch (err: any) {
      console.error(err);
      setAiInspiration(`Failed to load AI ideas. Detail: ${err?.message || "Please try again shortly."}`);
    } finally {
      setIsAiProcessing(false);
    }
  };

  // --- Google Drive Commands ---
  const handleConnectDrive = async () => {
    try {
      const u = await signIn();
      const token = await getAccessToken();
      setDriveToken(token);
      setUser(u);
      return token;
    } catch (err: any) {
      console.error("Failed to connect Google Drive:", err);
      alert(`Sync Error: ${err.message || err}`);
      return null;
    }
  };

  const handleDisconnectDrive = useCallback(async () => {
    try {
      await signOut();
      setDriveToken(null);
      setLoadedDriveFileId(null);
      setLoadedDriveFileName(null);
      setCanvasBackgroundImage(null);
    } catch (err) {
      console.error("Failed disconnect:", err);
    }
  }, []);

  const handleLoadWorkspace = useCallback((loadedLayers: any[], fileName: string, fileId: string) => {
    setLayers(loadedLayers);
    if (loadedLayers.length > 0) {
      setActiveLayerId(loadedLayers[loadedLayers.length - 1].id);
    }
    setLoadedDriveFileId(fileId);
    setLoadedDriveFileName(fileName);
    setRedoStack([]);
    setWorkspaceSessionId(Date.now().toString());
  }, []);

  const handleImportBackgroundImage = useCallback((imageUrl: string) => {
    setCanvasBackgroundImage(imageUrl);
  }, []);

  const loadFromGallery = (drawing: Drawing) => {
    if (drawing.strokes) {
      try {
        const loaded = JSON.parse(drawing.strokes);
        if (Array.isArray(loaded) && loaded[0]?.name) {
          // It's the new layer format
          setLayers(loaded);
          setActiveLayerId(loaded[loaded.length - 1].id);
        } else {
          // Old format
          setLayers([{
            id: 'layer-1',
            name: 'Imported',
            strokes: loaded,
            visible: true,
            opacity: 1
          }]);
          setActiveLayerId('layer-1');
        }
        setRedoStack([]);
        setShowGallery(false);
        setWorkspaceSessionId(Date.now().toString());
      } catch (e) {
        console.error("Failed to load drawing strokes", e);
      }
    }
  };

  const addLayer = () => {
    const newId = `layer-${Date.now()}`;
    setLayers(prev => [...prev, {
      id: newId,
      name: `Layer ${prev.length + 1}`,
      strokes: [],
      visible: true,
      opacity: 1
    }]);
    setActiveLayerId(newId);
  };

  const deleteLayer = (id: string) => {
    if (layers.length <= 1) return;
    setLayers(prev => {
      const filtered = prev.filter(l => l.id !== id);
      if (activeLayerId === id) {
        setActiveLayerId(filtered[filtered.length - 1].id);
      }
      return filtered;
    });
  };

  const toggleLayerVisibility = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const setLayerOpacity = (id: string, opacity: number) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity } : l));
  };

  const deleteDrawing = async (id: string) => {
    if (window.confirm('Delete this masterpiece?')) {
      try {
        await deleteDoc(doc(db, 'drawings', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `drawings/${id}`);
      }
    }
  };

  const getCanvasDataUrl = useCallback((): string => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        tCtx.fillStyle = '#FFFFFF';
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tCtx.drawImage(canvas, 0, 0);
      }
      return tempCanvas.toDataURL('image/png', 0.8);
    } catch (e) {
      console.error(e);
      return '';
    }
  }, []);

  if (loading) return null;

  if (!user) {
    return (
      <LandingPage
        user={user}
        onEnterCanvas={() => setShowLanding(false)}
        onOpenDashboard={() => {
          setShowLanding(false);
          setShowDashboard(true);
        }}
        onOpenGallery={() => {
          setShowLanding(false);
          setShowGallery(true);
        }}
        onSignIn={signIn}
        savedDrawingsCount={drawings.length}
        allowTouch={allowTouch}
        setAllowTouch={(val) => {
          setAllowTouch(val);
          setPenOnly(allowPen && !val && !allowMouse);
        }}
        simulationMode={simulationMode}
        setSimulationMode={setSimulationMode}
        pressureOffset={pressureOffset}
        setPressureOffset={setPressureOffset}
        pressureScale={pressureScale}
        setPressureScale={setPressureScale}
        focusMode={focusMode}
        setFocusModeExplicit={setFocusModeExplicit}
      />
    );
  }

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

      {/* Google Drive Imported Tracing Image */}
      {canvasBackgroundImage && (
        <div className="absolute inset-x-8 inset-y-16 flex items-center justify-center pointer-events-none opacity-45 select-none z-10">
          <img 
            src={canvasBackgroundImage} 
            className="max-w-full max-h-full object-contain filter grayscale select-none" 
            alt="Imported Tracing Reference" 
          />
          <button 
            onClick={() => setCanvasBackgroundImage(null)}
            className="absolute top-4 right-4 p-2 bg-black text-white hover:bg-neutral-800 rounded-xl text-[9px] uppercase tracking-wider font-extrabold pointer-events-auto shadow-xl flex items-center gap-1.5"
            title="Clear Trace Reference"
          >
            <X size={11} /> Clear Reference
          </button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className={`block touch-none ${mode === 'erase' ? 'cursor-crosshair' : 'active:cursor-none'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Top Left Menu & Status Banner Stacked Column */}
      <div className="absolute top-6 left-6 z-40 flex flex-col gap-2.5 items-start pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button 
            onClick={() => setShowLanding(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/80 backdrop-blur hover:bg-white text-zinc-800 rounded-full text-[10.5px] uppercase font-bold border border-black/10 shadow-sm transition-all duration-200 active:scale-95"
            title="Return to Welcome Landing"
          >
            <Home size={13} className="text-zinc-700" />
            <span>Welcome Page</span>
          </button>
          {user ? (
            <button 
              onClick={() => setShowDashboard(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white/80 backdrop-blur rounded-full border border-black/10 shadow-sm hover:scale-105 active:scale-95 hover:bg-white transition-all duration-200"
              title="Open Home Dashboard"
            >
              <img src={user.photoURL || ''} className="w-6 h-6 rounded-full border border-black/10" alt="avatar" />
              <span className="text-[10.5px] font-bold uppercase tracking-tight max-w-[100px] truncate">{user.displayName}</span>
            </button>
          ) : (
            <button 
              onClick={() => setShowDashboard(true)}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full text-[10.5px] uppercase font-bold shadow-lg hover:scale-105 transition-transform active:scale-95"
              title="Open Home Dashboard"
            >
              <UserIcon size={14} /> Dashboard Home
            </button>
          )}
        </div>

        {/* Overlay Status info neatly tucked below the auth/home buttons without collision */}
        {!showGallery && !showDashboard && !showLanding && (
          <div className="pl-1.5 pointer-events-none opacity-35 flex flex-col gap-0.5">
            <h1 className="text-[10px] font-black tracking-tighter uppercase italic text-zinc-900">S Pen Draw Pro</h1>
            <p className="text-[8px] font-mono uppercase tracking-[0.18em] text-zinc-700">
              {layers.reduce((sum, l) => sum + l.strokes.length, 0)} STROKES • {layers.length} LAYERS • {mode.toUpperCase()}
            </p>
          </div>
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
              <ToolButton active={penOnly} onClick={toggleStylusLock} icon={<Plus size={18} className={penOnly ? 'rotate-45' : ''} />} label="Stylus Lock" />
            </div>

            <div className="flex items-center gap-1.5 border-r border-black/10 pr-3">
              <AnimatePresence mode="wait">
                {!colorChangerExpanded ? (
                  <motion.button
                    key="folded"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    onClick={() => setColorChangerExpanded(true)}
                    className="w-7 h-7 rounded-full border border-black/15 flex items-center justify-center shadow-md cursor-pointer hover:scale-110 active:scale-95 transition-all"
                    style={{ backgroundColor: color }}
                    title="Expand Color Palette"
                  >
                    <Palette size={13} className={(hexToRgb(color).r * 299 + hexToRgb(color).g * 587 + hexToRgb(color).b * 114) / 1000 > 180 ? 'text-black/70' : 'text-white/90'} />
                  </motion.button>
                ) : (
                  <motion.div
                    key="expanded"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="flex items-center gap-1.5"
                  >
                    {COLORS.map(c => (
                      <button
                        key={c}
                        onClick={() => { 
                          setColor(c); 
                          setMode('draw'); 
                          setColorChangerExpanded(false); 
                        }}
                        className={`w-6 h-6 rounded-full border-2 transition-all hover:scale-110 active:scale-95 shrink-0 ${color === c && mode === 'draw' ? 'border-black scale-110 shadow-lg' : 'border-black/5'}`}
                        style={{ backgroundColor: c }}
                        title={`Select ${c}`}
                      />
                    ))}
                    <div className="w-px h-4 bg-black/5 mx-0.5 shrink-0" />
                    <button
                      onClick={() => colorInputRef.current?.click()}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shrink-0 ${!COLORS.includes(color) && mode === 'draw' ? 'border-black scale-110 shadow-lg' : 'border-black/5 bg-zinc-100'}`}
                      style={{ backgroundColor: !COLORS.includes(color) ? color : undefined }}
                      title="System Color Picker"
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
                          setColorChangerExpanded(false);
                        }}
                      />
                    </button>

                    <button
                      onClick={() => {
                        setShowColorStudio(!showColorStudio);
                        if (showLayers) setShowLayers(false);
                      }}
                      className={`p-1.5 rounded-lg transition-all hover:scale-110 active:scale-95 shrink-0 ${showColorStudio ? 'bg-black text-white shadow-md' : 'hover:bg-black/5 text-zinc-650 opacity-65 hover:opacity-100'}`}
                      title="Toggle Color Studio"
                    >
                      <Palette size={15} />
                    </button>

                    <button
                      onClick={() => setColorChangerExpanded(false)}
                      className="p-1 hover:bg-black/5 rounded text-zinc-400 hover:text-zinc-650 transition-colors ml-1 shrink-0 bg-transparent border-none cursor-pointer"
                      title="Fold Color Palette"
                    >
                      <ChevronRight size={14} className="rotate-180" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
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
              <ActionButton onClick={undo} disabled={layers.find(l => l.id === activeLayerId)?.strokes.length === 0} icon={<Undo size={16} />} />
              <ActionButton onClick={redo} disabled={redoStack.length === 0} icon={<Redo size={16} />} />
              <ActionButton onClick={clear} icon={<Trash2 size={16} />} />
              <ActionButton 
                onClick={saveToGallery} 
                disabled={saveStatus === 'saving'}
                icon={
                  saveStatus === 'saving' ? (
                    <Loader2 size={16} className="animate-spin text-zinc-500" />
                  ) : saveStatus === 'success' ? (
                    <motion.div
                      key="checked"
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      className="flex items-center justify-center text-emerald-500 font-bold"
                    >
                      <Check size={16} strokeWidth={3} />
                    </motion.div>
                  ) : saveStatus === 'error' ? (
                    <span className="text-red-500 font-bold text-xs">!</span>
                  ) : (
                    <Save size={16} className="transition-all" />
                  )
                }
                title="Save Drawing to Gallery"
              />
              <ActionButton 
                onClick={exportToPdf} 
                disabled={pdfExportStatus === 'exporting'}
                icon={
                  pdfExportStatus === 'exporting' ? (
                    <Loader2 size={16} className="animate-spin text-zinc-500" />
                  ) : pdfExportStatus === 'success' ? (
                    <motion.div
                      key="pdf-checked"
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.4, opacity: 0 }}
                      className="flex items-center justify-center text-emerald-500 font-bold"
                    >
                      <Check size={16} strokeWidth={3} />
                    </motion.div>
                  ) : pdfExportStatus === 'error' ? (
                    <span className="text-red-500 font-bold text-xs">!</span>
                  ) : (
                    <Download size={16} className="transition-all" />
                  )
                }
                title="Export Workspace as PDF"
              />
              <div className="w-px h-4 bg-black/10 mx-1" />
              <button 
                onClick={() => setBackgroundType(prev => 
                  prev === 'none' ? 'dots' : prev === 'dots' ? 'grid' : prev === 'grid' ? 'lines' : 'none'
                )}
                className="p-2 rounded-xl hover:bg-black/5 opacity-40 uppercase text-[8px] font-bold tracking-tighter"
              >
                {backgroundType || 'BG'}
              </button>
              <ActionButton onClick={() => setShowLayers(!showLayers)} active={showLayers} icon={<Layers size={16} />} />
              <ActionButton onClick={() => setShowGallery(true)} icon={<Grid2X2 size={16} />} />
              <ActionButton onClick={() => setShowDriveHub(true)} active={showDriveHub} icon={<Cloud size={16} />} />
              <ActionButton onClick={() => setShowWorkspaceHub(true)} active={showWorkspaceHub} icon={<Briefcase size={16} />} />
              <ActionButton onClick={() => setShowAndroidDevHub(true)} active={showAndroidDevHub} icon={<Smartphone size={16} />} title="Android S Pen Dev Hub (AI)" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Layers Panel */}
      <AnimatePresence>
        {showLayers && !showGallery && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="absolute top-24 right-8 w-64 bg-white/90 backdrop-blur-xl border border-black/10 rounded-3xl shadow-2xl z-50 p-6 flex flex-col gap-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black uppercase italic tracking-tighter text-sm">Layers</h3>
              <button onClick={addLayer} className="p-1 hover:bg-black/5 rounded-full">
                <Plus size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto touch-auto pr-2">
              {[...layers].reverse().map(layer => (
                <div 
                  key={layer.id}
                  onClick={() => setActiveLayerId(layer.id)}
                  className={`group flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${activeLayerId === layer.id ? 'bg-black text-white border-black shadow-lg scale-102' : 'bg-transparent border-black/5 hover:border-black/20'}`}
                >
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                    className={`transition-opacity ${activeLayerId === layer.id ? 'text-white/40 hover:text-white' : 'text-black/40 hover:text-black'}`}
                  >
                    {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-tight truncate">{layer.name}</p>
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={layer.opacity}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setLayerOpacity(layer.id, parseFloat(e.target.value))}
                      className={`w-full h-0.5 mt-1 appearance-none bg-current opacity-20 accent-current`}
                    />
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                    className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-500 hover:text-white rounded-md ${activeLayerId === layer.id ? 'text-white/40' : 'text-black/40'}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setShowLayers(false)}
              className="mt-2 w-full py-2 bg-black/5 hover:bg-black/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-center"
            >
              Close
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Color Studio Panel */}
      <AnimatePresence>
        {showColorStudio && !showGallery && (
          <motion.div
            initial={{ y: 20, x: '-50%', opacity: 0 }}
            animate={{ y: 0, x: '-50%', opacity: 1 }}
            exit={{ y: 20, x: '-50%', opacity: 0 }}
            className="absolute bottom-28 left-1/2 w-[340px] bg-white/95 backdrop-blur-xl border border-black/10 rounded-[28px] shadow-2xl z-50 p-6 flex flex-col gap-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette size={14} className="text-zinc-500" />
                <h3 className="font-black uppercase italic tracking-tighter text-xs">Color Studio</h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={addCurrentColorToSwatches}
                  className="px-2.5 py-1 bg-black text-white hover:bg-zinc-800 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all"
                  title="Add to Custom Swatches"
                >
                  Save Swatch
                </button>
                <button 
                  onClick={() => setShowColorStudio(false)} 
                  className="p-1.5 hover:bg-black/5 rounded-full text-zinc-400 hover:text-zinc-650 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Brush & Color Preview Section */}
            <div className="flex items-center gap-4 bg-zinc-50 p-3 rounded-2xl border border-black/5">
              <div className="relative w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden border border-black/10 bg-white shadow-inner">
                <div 
                  className="absolute inset-0 opacity-10" 
                  style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '6px 6px' }} 
                />
                <div 
                  className="rounded-full shadow-md z-10 transition-all duration-200"
                  style={{ 
                    backgroundColor: color, 
                    width: Math.max(8, Math.min(40, baseWidth)), 
                    height: Math.max(8, Math.min(40, baseWidth)) 
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-tight text-zinc-900 truncate">Brush Color Preview</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[9px] text-zinc-400">HEX:</span>
                  <input 
                    type="text"
                    value={color}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith('#') && val.length <= 7) {
                        setColor(val);
                        setMode('draw');
                      }
                    }}
                    className="bg-transparent border-none font-mono text-xs font-bold text-zinc-700 w-16 focus:outline-none uppercase"
                  />
                  <button 
                    onClick={() => colorInputRef.current?.click()}
                    className="p-1 hover:bg-black/5 rounded text-zinc-400 hover:text-zinc-600 transition-colors"
                    title="System Spectrum Picker"
                  >
                    <Pipette size={11} />
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive RGB Sliders Widget */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-400 flex items-center gap-1">
                  <Sliders size={10} /> RGB Controllers
                </span>
                <span className="font-mono text-[9px] text-zinc-400 font-bold">
                  rgb({rgb.r}, {rgb.g}, {rgb.b})
                </span>
              </div>

              {/* Red Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-mono leading-none">
                  <span className="font-semibold text-red-500">Red Channel</span>
                  <span>{rgb.r}</span>
                </div>
                <div className="relative flex items-center">
                  <input 
                    type="range"
                    min="0"
                    max="255"
                    value={rgb.r}
                    onChange={(e) => handleRgbChange('r', parseInt(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-red-500 bg-gradient-to-r from-zinc-100 to-red-500"
                  />
                </div>
              </div>

              {/* Green Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-mono leading-none">
                  <span className="font-semibold text-green-500">Green Channel</span>
                  <span>{rgb.g}</span>
                </div>
                <div className="relative flex items-center">
                  <input 
                    type="range"
                    min="0"
                    max="255"
                    value={rgb.g}
                    onChange={(e) => handleRgbChange('g', parseInt(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-green-500 bg-gradient-to-r from-zinc-100 to-green-500"
                  />
                </div>
              </div>

              {/* Blue Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-mono leading-none">
                  <span className="font-semibold text-blue-500">Blue Channel</span>
                  <span>{rgb.b}</span>
                </div>
                <div className="relative flex items-center">
                  <input 
                    type="range"
                    min="0"
                    max="255"
                    value={rgb.b}
                    onChange={(e) => handleRgbChange('b', parseInt(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-500 bg-gradient-to-r from-zinc-100 to-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Custom Palette Swatches */}
            <div className="space-y-2 pt-2 border-t border-black/5">
              <h4 className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">Custom Swatches Saved</h4>
              <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto touch-auto pr-1">
                {customSwatches.length === 0 ? (
                  <p className="text-[9px] text-zinc-400 italic">No custom swatches saved yet. Click Save Swatch above!</p>
                ) : (
                  customSwatches.map((swatch, idx) => (
                    <div key={`${swatch}-${idx}`} className="group relative">
                      <button
                        onClick={() => { setColor(swatch); setMode('draw'); }}
                        className={`w-6 h-6 rounded-lg border transition-all hover:scale-110 active:scale-95 ${color === swatch && mode === 'draw' ? 'border-black scale-110 shadow-lg' : 'border-black/5'}`}
                        style={{ backgroundColor: swatch }}
                        title={`Select ${swatch}`}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); removeSwatch(swatch); }}
                        className="absolute -top-1.5 -right-1.5 bg-black text-white w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono font-black text-[7px] leading-none opacity-0 group-hover:opacity-100 transition-opacity border border-white hover:bg-red-500"
                        title="Delete swatch"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Home Dashboard Overlay */}
      <AnimatePresence>
        {showDashboard && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="absolute inset-0 bg-[#F5F5F0] z-[120] overflow-y-auto touch-auto p-4 md:p-8 select-auto"
          >
            <div className="max-w-6xl mx-auto bg-white border border-black/10 rounded-[32px] overflow-hidden shadow-2xl min-h-[90vh] flex flex-col md:flex-row">
              {/* Left Column: User Profile & Quick States */}
              <div className="w-full md:w-[320px] bg-zinc-50 border-b md:border-b-0 md:border-r border-black/5 p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-8">
                    <button 
                      onClick={() => setShowDashboard(false)}
                      className="w-10 h-10 bg-black text-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                    >
                      <ChevronRight className="rotate-180" size={20} />
                    </button>
                    <div>
                      <h2 className="text-xl font-black italic uppercase tracking-tighter">Studio Home</h2>
                      <p className="text-[9px] font-mono opacity-40 uppercase tracking-widest">Workspace Profile</p>
                    </div>
                  </div>

                  {user ? (
                    <div className="space-y-6">
                      <div className="bg-white border border-black/10 p-5 rounded-2xl flex flex-col items-center text-center shadow-sm">
                        <img src={user.photoURL || ''} className="w-16 h-16 rounded-full border border-black/10 mb-3 shadow-[0_4px_12px_rgba(0,0,0,0.05)]" alt="avatar" />
                        <h3 className="font-extrabold uppercase text-xs tracking-tight text-zinc-900">{user.displayName}</h3>
                        <p className="text-[10px] font-mono text-zinc-400 mt-1 max-w-full truncate">{user.email}</p>
                        <div className="mt-4 flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full font-mono text-[8px] uppercase tracking-wide font-semibold border border-green-200/50">
                          <Circle size={6} className="fill-current animate-pulse text-green-500" /> Cloud Sync Active
                        </div>
                      </div>

                      <div className="bg-white border border-black/10 p-5 rounded-2xl space-y-4">
                        <h4 className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">Mastery Snapshot</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-2xl font-black italic text-zinc-900 leading-none">{drawings.length}</p>
                            <p className="text-[8px] font-mono uppercase tracking-tight text-zinc-400 mt-1">Sketches Saved</p>
                          </div>
                          <div>
                            <p className="text-2xl font-black italic text-zinc-900 leading-none">
                              {layers.reduce((sum, l) => sum + l.strokes.length, 0)}
                            </p>
                            <p className="text-[8px] font-mono uppercase tracking-tight text-zinc-400 mt-1 font-semibold">Active Strokes</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-black/5 flex justify-between text-[10px]">
                          <span className="opacity-40 uppercase font-bold tracking-tight">Active Layers:</span>
                          <span className="font-bold">{layers.length} Layers</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-zinc-100 border border-transparent p-5 rounded-2xl text-center shadow-inner space-y-4 mb-6">
                      <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center mx-auto text-zinc-500">
                        <UserIcon size={20} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-black text-xs uppercase text-zinc-800">Local Guest Mode</h3>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">Log in with your Google account to enable secure database backups and Gemini assistant recommendations!</p>
                      </div>
                      <button 
                        onClick={() => { signIn(); }}
                        className="w-full py-2.5 bg-black text-white text-[10px] uppercase font-bold rounded-xl hover:bg-zinc-800 transition-colors tracking-widest shadow-md"
                      >
                        Connect Google Account
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-8 space-y-4">
                  {user && (
                    <button 
                      onClick={() => { signOut(); setShowDashboard(false); }}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded-xl font-bold uppercase text-[10px] tracking-wider transition-colors"
                    >
                      <LogOut size={14} /> Sign Out Account
                    </button>
                  )}
                  <div className="text-center opacity-30">
                    <p className="text-[8px] font-mono uppercase tracking-widest">S Pen Draw Pro • v2.1.0</p>
                  </div>
                </div>
              </div>

              {/* Right Column: S Pen Calibration Lab & Creator Quick Start */}
              <div className="flex-1 p-8 md:p-12 flex flex-col justify-between space-y-8">
                <div>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-black/5">
                    <div>
                      <h1 className="text-3xl font-extrabold tracking-tighter uppercase italic">Creative Dashboard</h1>
                      <p className="text-xs text-zinc-500 font-medium">Calibrate your stylus pressure settings and manage active sketch presets.</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setShowDashboard(false);
                          setShowGallery(true);
                        }}
                        className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-full font-bold uppercase text-[9px] tracking-wider transition-all flex items-center gap-2"
                      >
                        <Grid2X2 size={12} /> Studio Gallery
                      </button>
                      <button 
                        onClick={() => setShowDashboard(false)}
                        className="px-5 py-2 bg-black text-white hover:bg-zinc-800 rounded-full font-bold uppercase text-[9px] tracking-wider transition-all flex items-center gap-2 shadow-lg"
                      >
                        <Pencil size={12} /> Canvas Workspace
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                    {/* S Pen Calibration Lab */}
                    <div className="bg-[#F9F9F7] border border-black/5 p-6 rounded-2xl flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                          <h3 className="font-mono text-[9px] uppercase tracking-widest text-zinc-400">Stylus V-Sensing Diagnostic</h3>
                        </div>
                        <h4 className="font-extrabold uppercase text-xs tracking-tight mb-2 text-zinc-800">Pressure Calibration Pad</h4>
                        <p className="text-[10px] text-zinc-500 leading-relaxed mb-4">Touch or hover with your stylus inside the pad below to diagnostic active pressure vectors. Adjust offset and scale values to fine-tune your stylus response.</p>
                      </div>

                      <div 
                        onPointerMove={handleTestPointerMove}
                        onPointerDown={handleTestPointerMove}
                        onPointerUp={handleTestPointerUp}
                        onPointerLeave={handleTestPointerUp}
                        className="relative h-44 bg-white border border-black/10 rounded-xl flex flex-col items-center justify-center cursor-crosshair overflow-hidden touch-none mb-4"
                        style={{ touchAction: 'none' }}
                      >
                        <div className="absolute top-2 left-2 text-[8px] font-mono bg-zinc-100 px-1.5 py-0.5 rounded opacity-50 uppercase">Diagnostic Stage</div>
                        
                        <p className="text-[8px] font-mono opacity-25 uppercase tracking-wide pointer-events-none mb-1">Press & Move Pen Here</p>
                        
                        {/* Live Pressure Circle visualization */}
                        <motion.div 
                          animate={{ 
                            scale: isTestingPressure 
                              ? 0.3 + (useRawCustomFormula ? (pressureOffset + pressureScale * testPressure) : (pressureOffset + pressureScale * testPressure) * 4) / 10
                              : 1,
                            opacity: isTestingPressure ? 0.3 + testPressure * 0.7 : 0.15
                          }}
                          className="w-16 h-16 rounded-full bg-zinc-950 flex items-center justify-center text-white pointer-events-none absolute"
                          style={{
                            boxShadow: isTestingPressure ? '0 10px 30px rgba(0,0,0,0.1)' : 'none'
                          }}
                        />

                        {/* Text Overlay live pressure indicators */}
                        <div className="absolute bottom-3 text-center pointer-events-none">
                          <p className="text-xs font-mono font-bold leading-none">{(testPressure * 100).toFixed(0)}%</p>
                          <p className="text-[8px] font-mono opacity-30 uppercase tracking-widest mt-1">
                            {isTestingPressure ? 'REGISTERING PRESSURE' : 'IDLE LEVEL'}
                          </p>
                        </div>
                      </div>

                      {/* Pressure Distribution Histogram Visualizer */}
                      <div className="bg-white border border-black/10 rounded-xl p-4 shadow-sm space-y-3 mb-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h5 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-700">Pressure Mapping Histogram</h5>
                            <p className="text-[8px] text-zinc-400 font-mono">
                              {pressureHistory.length >= 2000 ? 'ROLLING CAPACITY LIMIT AT 2,000 SAMPLES' : `${pressureHistory.length} SAMPLE POINTS REGISTERED`}
                            </p>
                          </div>
                          {pressureHistory.length > 0 && (
                            <button
                              onClick={() => setPressureHistory([])}
                              className="text-[8px] font-mono hover:text-red-500 hover:border-red-400 uppercase font-bold border border-zinc-200 px-2 py-1 rounded-md transition-all active:scale-95"
                            >
                              Reset Live Data
                            </button>
                          )}
                        </div>

                        {/* Summary Statistics Pill Grid */}
                        <div className="grid grid-cols-4 gap-1.5 text-center">
                          <div className="bg-[#F8F9FA] rounded-lg p-1.5 border border-black/5">
                            <p className="text-[7.5px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Mean</p>
                            <p className="text-[11px] font-mono font-bold text-zinc-800">
                              {pressureHistory.length > 0
                                ? `${((pressureHistory.reduce((s, x) => s + x, 0) / pressureHistory.length) * 100).toFixed(0)}%`
                                : '0%'
                              }
                            </p>
                          </div>
                          <div className="bg-[#F8F9FA] rounded-lg p-1.5 border border-black/5">
                            <p className="text-[7.5px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Min</p>
                            <p className="text-[11px] font-mono font-bold text-zinc-800">
                              {pressureHistory.length > 0
                                ? `${(Math.min(...pressureHistory) * 100).toFixed(0)}%`
                                : '0%'
                              }
                            </p>
                          </div>
                          <div className="bg-[#F8F9FA] rounded-lg p-1.5 border border-black/5">
                            <p className="text-[7.5px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Max</p>
                            <p className="text-[11px] font-mono font-bold text-zinc-800">
                              {pressureHistory.length > 0
                                ? `${(Math.max(...pressureHistory) * 100).toFixed(0)}%`
                                : '0%'
                              }
                            </p>
                          </div>
                          <div className="bg-[#F8F9FA] rounded-lg p-1.5 border border-black/5">
                            <p className="text-[7.5px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">Count</p>
                            <p className="text-[11px] font-mono font-bold text-zinc-800">
                              {pressureHistory.length}
                            </p>
                          </div>
                        </div>

                        {/* SVG Histogram Canvas */}
                        <div className="relative h-28 bg-[#fafafa] border border-black/5 rounded-lg flex flex-col justify-end overflow-hidden">
                          {pressureHistory.length === 0 ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center pointer-events-none">
                              <p className="text-[9px] font-mono text-zinc-400 uppercase tracking-wide font-black">No Diagnostics Logged</p>
                              <p className="text-[8px] text-zinc-400 leading-normal max-w-[200px] mt-1">Please draw on the canvas or S-Pen test pad to generate diagnostic data map.</p>
                            </div>
                          ) : (() => {
                            const maxCount = Math.max(...pressureBins, 1);
                            const svgHeight = 70;
                            const svgWidth = 280;
                            const barWidth = 24;
                            const gap = 3;
                            
                            return (
                              <svg viewBox={`0 0 ${svgWidth} 100`} className="w-full h-full p-2" aria-label="Pressure Distribution Histogram">
                                {/* Subtle grid lines */}
                                <line x1="0" y1="15" x2={svgWidth} y2="15" stroke="#000" strokeOpacity="0.04" strokeWidth="1" strokeDasharray="2,2" />
                                <line x1="0" y1="40" x2={svgWidth} y2="40" stroke="#000" strokeOpacity="0.04" strokeWidth="1" strokeDasharray="2,2" />
                                <line x1="0" y1="65" x2={svgWidth} y2="65" stroke="#000" strokeOpacity="0.04" strokeWidth="1" strokeDasharray="2,2" />
                                
                                {pressureBins.map((count, i) => {
                                  const h = (count / maxCount) * svgHeight;
                                  const x = i * (barWidth + gap) + 6;
                                  const y = svgHeight - h + 12;
                                  const isActiveBin = liveActive && activePressure >= i / 10 && activePressure < (i + 1) / 10;
                                  
                                  return (
                                    <g key={i} className="group">
                                      {/* Highlight rectangle behind the bar when active */}
                                      {isActiveBin && (
                                        <rect
                                          x={x - 1}
                                          y={6}
                                          width={barWidth + 2}
                                          height={svgHeight + 10}
                                          fill="#f97316"
                                          fillOpacity="0.06"
                                          rx="2"
                                        />
                                      )}

                                      {/* SVG Rect bar */}
                                      <rect
                                        x={x}
                                        y={y}
                                        width={barWidth}
                                        height={Math.max(2, h)}
                                        rx="3"
                                        fill={isActiveBin ? '#f97316' : '#27272a'}
                                        opacity={isActiveBin ? 0.95 : (0.25 + (h / svgHeight) * 0.7)}
                                        className="transition-all duration-300 hover:fill-orange-500 hover:opacity-100"
                                      />
                                      
                                      {/* Count label above bar */}
                                      {(count > 0 || isActiveBin) && (
                                        <text
                                          x={x + barWidth / 2}
                                          y={y - 3}
                                          textAnchor="middle"
                                          className={`font-mono text-[6.5px] font-bold ${isActiveBin ? 'fill-orange-600' : 'fill-zinc-500'}`}
                                        >
                                          {count}
                                        </text>
                                      )}

                                      {/* X Axis Labels under bar */}
                                      <text
                                        x={x + barWidth / 2}
                                        y={svgHeight + 22}
                                        textAnchor="middle"
                                        className={`font-mono text-[6px] font-bold ${isActiveBin ? 'fill-orange-500' : 'fill-zinc-400'}`}
                                      >
                                        {(i / 10).toFixed(1)}
                                      </text>
                                    </g>
                                  );
                                })}
                                {/* Base bottom axis line */}
                                <line x1="0" y1={svgHeight + 12} x2={svgWidth} y2={svgHeight + 12} stroke="#000" strokeOpacity="0.08" strokeWidth="1" />
                              </svg>
                            );
                          })()}
                        </div>
                        
                        <div className="flex justify-between items-center text-[7.5px] font-mono text-zinc-400 px-1 opacity-70 uppercase leading-none">
                          <span>Hover / Light Touch</span>
                          <span>Max Force (100%)</span>
                        </div>
                      </div>

                      {/* Pressure Calibration Settings Row */}
                      <div className="space-y-4 border-t border-black/5 pt-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-tight text-zinc-700 block">Pressure sensitivity mapping</span>
                            <span className="text-[8px] font-mono text-zinc-400 uppercase tracking-widest leading-none">Formula Mode</span>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => {
                                setUseRawCustomFormula(true);
                                try { localStorage.setItem('s_pen_use_raw_formula', 'true'); } catch {}
                              }}
                              className={`px-2 py-1 font-mono text-[8px] rounded uppercase font-bold transition-all ${useRawCustomFormula ? 'bg-black text-white' : 'bg-transparent border border-black/10 text-zinc-500 hover:border-black/30'}`}
                              title="Formula: Offset + Scale * Pressure"
                            >
                              Strict Range
                            </button>
                            <button
                              onClick={() => {
                                setUseRawCustomFormula(false);
                                try { localStorage.setItem('s_pen_use_raw_formula', 'false'); } catch {}
                              }}
                              className={`px-2 py-1 font-mono text-[8px] rounded uppercase font-bold transition-all ${!useRawCustomFormula ? 'bg-black text-white' : 'bg-transparent border border-black/10 text-zinc-500 hover:border-black/30'}`}
                              title="Formula: BrushWidth * (Offset + Scale * Pressure)"
                            >
                              Brush Relative
                            </button>
                          </div>
                        </div>

                        {/* Active Formula Indicator Badge */}
                        <div className="bg-zinc-100 border border-black/5 rounded-xl p-2.5 font-mono text-[8.5px] text-zinc-650 flex flex-col gap-1 shadow-inner">
                          <div className="flex justify-between items-center">
                            <span className="opacity-55 uppercase text-[7.5px] font-extrabold">Active Paint Formula:</span>
                            <span className="font-bold text-orange-600 uppercase tracking-tight">Active</span>
                          </div>
                          <span className="font-bold text-black bg-white px-2 py-1 rounded border border-black/5 shadow-sm text-center">
                            {useRawCustomFormula 
                              ? `Paint.strokeWidth = ${pressureOffset.toFixed(1)} + ${pressureScale.toFixed(1)} * pressure`
                              : `Paint.strokeWidth = ${baseWidth}px * (${pressureOffset.toFixed(1)} + ${pressureScale.toFixed(1)} * pressure)`
                            }
                          </span>
                        </div>

                        {/* Offset slider */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-mono leading-none">
                            <span className="font-semibold text-zinc-500">Base Offset (pressureOffset)</span>
                            <span className="font-black text-black">{pressureOffset.toFixed(1)}</span>
                          </div>
                          <input 
                            type="range"
                            min="0.1"
                            max="8.0"
                            step="0.1"
                            value={pressureOffset}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setPressureOffset(val);
                              try { localStorage.setItem('s_pen_pressure_offset', String(val)); } catch {}
                            }}
                            className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-black"
                          />
                        </div>

                        {/* Scale slider */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] font-mono leading-none">
                            <span className="font-semibold text-zinc-500">Dynamic Scale (pressureScale)</span>
                            <span className="font-black text-black">+{pressureScale.toFixed(1)}</span>
                          </div>
                          <input 
                            type="range"
                            min="0.0"
                            max="20.0"
                            step="0.1"
                            value={pressureScale}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setPressureScale(val);
                              try { localStorage.setItem('s_pen_pressure_scale', String(val)); } catch {}
                            }}
                            className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-black"
                          />
                        </div>
                      </div>
                      
                      {/* Input Device Selection & Filter Settings */}
                      <div className="mt-4 pt-4 border-t border-black/5 space-y-4">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-tight text-zinc-800 block mb-1">Workspace Input Focus Mode</span>
                          <span className="text-[8px] font-mono text-zinc-400 uppercase tracking-widest block mb-3">Manual Override Toggle</span>
                          
                          {/* Segmented active slider switch */}
                          <div className="bg-zinc-100 p-1.5 rounded-2xl flex gap-1.5 border border-black/5 shadow-inner">
                            <button
                              onClick={() => setFocusModeExplicit('touch')}
                              className={`flex-1 py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                                focusMode === 'touch'
                                  ? 'bg-white text-black border border-black/10 shadow-sm font-black'
                                  : 'text-zinc-500 hover:text-black hover:bg-black/5 font-semibold'
                              }`}
                              title="Focus on fingers and mouse gestures"
                            >
                              <div className="flex items-center gap-1.5">
                                <Hand size={14} className={focusMode === 'touch' ? 'text-black' : 'text-zinc-400'} />
                                <span className="text-[10.5px] uppercase tracking-wide">Touch Focus</span>
                              </div>
                              <span className="text-[7.5px] font-mono opacity-50 uppercase">Finger & Passive Pens</span>
                            </button>

                            <button
                              onClick={() => setFocusModeExplicit('pen')}
                              className={`flex-1 py-2.5 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                                focusMode === 'pen'
                                  ? 'bg-black text-white border border-transparent shadow-md font-black'
                                  : 'text-zinc-500 hover:text-black hover:bg-black/5 font-semibold'
                              }`}
                              title="Focus exclusively on active stylus/S Pen and palm rejection"
                            >
                              <div className="flex items-center gap-1.5">
                                <Pencil size={14} className={focusMode === 'pen' ? 'text-white font-black' : 'text-zinc-400'} />
                                <span className="text-[10.5px] uppercase tracking-wide">Pen Focus</span>
                              </div>
                              <span className="text-[7.5px] font-mono opacity-60 uppercase">Active Stylus Block</span>
                            </button>
                          </div>
                        </div>

                        {/* Diagnostics & Manual Settings Overrides wrapper */}
                        <div className="space-y-2 bg-zinc-50 border border-black/5 p-3 rounded-xl">
                          <span className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-zinc-400">Current Filters Status:</span>
                          <div className="grid grid-cols-3 gap-1.5 text-[8.5px] font-mono text-zinc-650">
                            <div className="bg-white border border-black/5 p-2 rounded-lg flex flex-col items-center">
                              <span className="opacity-50">STYLUS</span>
                              <span className="font-extrabold text-black mt-1">ENABLED</span>
                            </div>
                            <div className="bg-white border border-black/5 p-2 rounded-lg flex flex-col items-center">
                              <span className="opacity-50">TOUCH</span>
                              <span className={`font-extrabold mt-1 ${focusMode === 'touch' ? 'text-green-600' : 'text-red-500'}`}>
                                {focusMode === 'touch' ? 'ACTIVE' : 'MUTED'}
                              </span>
                            </div>
                            <div className="bg-white border border-black/5 p-2 rounded-lg flex flex-col items-center">
                              <span className="opacity-50">MOUSE</span>
                              <span className={`font-extrabold mt-1 ${focusMode === 'touch' ? 'text-green-600' : 'text-red-500'}`}>
                                {focusMode === 'touch' ? 'ACTIVE' : 'MUTED'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Pressure Simulation Section (for Touch, Mouse, or non-sensitive pens) */}
                        <div className="space-y-3 bg-zinc-50 border border-black/5 p-3.5 rounded-2xl">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-bold uppercase tracking-tight text-zinc-700 block">Pressure Emulation</span>
                              <span className="text-[8px] font-mono text-zinc-400 uppercase tracking-widest leading-none">For Finger/Generic Pens</span>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setSimulationMode('velocity');
                                  try { localStorage.setItem('s_pen_simulation_mode', 'velocity'); } catch {}
                                }}
                                className={`px-2 py-1 font-mono text-[8px] rounded uppercase font-bold transition-all ${simulationMode === 'velocity' ? 'bg-black text-white' : 'bg-white border border-black/10 text-zinc-500 hover:border-black/30'}`}
                                title="Dynamic thickness based on stroke speed"
                              >
                                Velocity
                              </button>
                              <button
                                onClick={() => {
                                  setSimulationMode('constant');
                                  try { localStorage.setItem('s_pen_simulation_mode', 'constant'); } catch {}
                                }}
                                className={`px-2 py-1 font-mono text-[8px] rounded uppercase font-bold transition-all ${simulationMode === 'constant' ? 'bg-black text-white' : 'bg-white border border-black/10 text-zinc-500 hover:border-black/30'}`}
                                title="Default stable simulated pressure"
                              >
                                Constant
                              </button>
                            </div>
                          </div>

                          {simulationMode === 'velocity' ? (
                            <p className="text-[8px] text-zinc-400 font-mono italic leading-normal">
                              ⚡ Velocity Emulation: Drawing faster creates lighter/thinner lines; drawing slower makes them fuller, simulating an S Pen natively with finger touch or mouse.
                            </p>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[9px] font-mono leading-none">
                                <span className="font-semibold text-zinc-500">Constant Emulated Pressure</span>
                                <span className="font-black text-black">{(constantPressureMultiplier * 100).toFixed(0)}%</span>
                              </div>
                              <input 
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.05"
                                value={constantPressureMultiplier}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setConstantPressureMultiplier(val);
                                  try { localStorage.setItem('s_pen_constant_pressure_multiplier', String(val)); } catch {}
                                }}
                                className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-black"
                              />
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-black/5 flex items-center justify-between">
                          <span className="text-[9px] font-mono opacity-40 uppercase tracking-widest">Pen Only Stylus Lock:</span>
                          <button 
                            onClick={toggleStylusLock}
                            className={`px-3 py-1 font-mono text-[9px] rounded-lg uppercase font-bold transition-all ${penOnly ? 'bg-black text-white border border-transparent' : 'bg-transparent border border-black/10 text-zinc-500 hover:border-black/30'}`}
                            title="Quick-toggle Pen Only Stylus mode (Disables Finger Touch to prevent palm-touch interference)"
                          >
                            {penOnly ? 'Enabled' : 'Disabled'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Presets and Customizations */}
                    <div className="space-y-6">
                      <div className="bg-zinc-50 border border-black/5 p-6 rounded-2xl">
                        <h4 className="text-[9px] font-mono uppercase tracking-widest text-zinc-400 mb-4">Background Grid Pattern</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {(['none', 'dots', 'grid', 'lines'] as const).map(pType => (
                            <button
                              key={pType}
                              onClick={() => setBackgroundType(pType)}
                              className={`py-2 px-3 border rounded-xl text-[10px] font-bold uppercase transition-all tracking-tight ${backgroundType === pType ? 'bg-black text-white border-black' : 'bg-white border-black/5 text-zinc-600 hover:border-black/20'}`}
                            >
                              {pType === 'none' ? 'Plain BG' : `${pType} Style`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-zinc-50 border border-black/5 p-6 rounded-2xl space-y-3">
                        <h4 className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">Brush Preset Shortcuts</h4>
                        <div className="flex flex-wrap gap-2">
                          {[2, 4, 8, 16, 24, 32, 64].map(w => (
                            <button
                              key={w}
                              onClick={() => setBaseWidth(w)}
                              className={`px-3 py-1.5 border rounded-lg font-mono text-xs transition-all ${baseWidth === w ? 'bg-black text-white border-black shadow' : 'bg-white border-black/5 text-zinc-600 hover:border-zinc-300'}`}
                            >
                              {w}px
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-zinc-400 leading-normal pt-2">Selecting brush presets sets the default width for stroke paths. Pen tip sizes scale proportionally with active pressure factors.</p>
                      </div>

                      {/* Flutter SDK Pressure Sensitivity Integration Panel */}
                      <div className="bg-[#121314] text-white p-6 rounded-2xl space-y-4 shadow-xl border border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#02569B]" /> 
                          <h4 className="text-[9px] font-mono uppercase tracking-widest text-zinc-400">Flutter Canvas Integration</h4>
                        </div>
                        <div>
                          <h5 className="font-extrabold uppercase text-[11px] tracking-tight text-white">Pressure sensitivity mapping</h5>
                          <p className="text-[9.5px] text-zinc-400 mt-1 leading-normal">
                            Access stylus pressure indicators inside the <code className="text-zinc-300 font-mono font-bold bg-white/5 px-1 py-0.5 rounded">onPanUpdate</code> event to dynamically scale brush width parameters.
                          </p>
                        </div>

                        {/* Interactive Scale factor slider */}
                        <div className="space-y-1 bg-white/5 p-3 rounded-xl border border-white/5">
                          <div className="flex justify-between text-[9px] font-mono leading-none text-zinc-300">
                            <span className="font-semibold text-zinc-400">Stroke width multiplier</span>
                            <span className="font-black text-white">{flutterMultiplier.toFixed(1)}x</span>
                          </div>
                          <input 
                            type="range"
                            min="1.0"
                            max="10.0"
                            step="0.5"
                            value={flutterMultiplier}
                            onChange={(e) => setFlutterMultiplier(parseFloat(e.target.value))}
                            className="w-full h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-white mt-1.5"
                          />
                        </div>

                        {/* Flutter Copyable Code Box */}
                        <div className="relative bg-black/40 border border-white/5 rounded-xl p-3.5 font-mono text-[8.5px] text-zinc-300 shadow-inner overflow-hidden">
                          <button
                            onClick={copyFlutterCode}
                            className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 transition-all active:scale-95 flex items-center gap-1.5 font-sans text-[8px] uppercase tracking-wider font-bold"
                          >
                            {isCopied ? (
                              <>
                                <Check size={10} className="text-green-400 font-extrabold" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={10} />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>
                          <pre className="text-left select-text pr-12 leading-relaxed overflow-x-auto whitespace-pre">
{`void onPanUpdate(GestureDragUpdateDetails details) {
  // Access input pressure level (stylus/mouse)
  double pressure = details.pressure ?? 1.0;
  
  // Heavier press dynamically adjusts the strokeWidth of the brush
  double strokeWidth = ${flutterMultiplier.toFixed(1)} * pressure;
  
  setState(() {
    points.add(DrawingPoint(
      point: details.localPosition,
      paint: Paint()
        ..color = activeColor
        ..strokeCap = StrokeCap.round
        ..strokeWidth = strokeWidth,
    ));
  });
}`}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Drawings carousel / row */}
                  <div className="mt-8">
                    <h3 className="text-xs uppercase tracking-widest font-mono opacity-40 mb-4">Recent Masterpieces</h3>
                    {drawings.length === 0 ? (
                      <div onClick={() => setShowDashboard(false)} className="h-32 border border-dashed border-black/10 hover:bg-[#eaeae5] bg-white/50 cursor-pointer rounded-2xl flex flex-col items-center justify-center opacity-40 transition-colors">
                        <Plus size={24} className="mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-wider">Start sketching to see your recent drafts here</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {drawings.slice(0, 4).map(d => (
                          <div 
                            key={d.id}
                            onClick={() => {
                              loadFromGallery(d);
                              setShowDashboard(false);
                            }}
                            className="bg-[#F9F9F7] border border-black/5 hover:border-black/20 cursor-pointer p-3 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-lg group"
                          >
                            <div className="aspect-[4/3] relative bg-white border border-black/5 rounded-xl overflow-hidden mb-2">
                              <img src={d.dataUrl} className="w-full h-full object-contain p-1.5 grayscale-[20%] group-hover:scale-105 transition-transform duration-300" alt={d.title} />
                            </div>
                            <h4 className="text-[9px] font-bold uppercase tracking-wide text-zinc-800 truncate">{d.title}</h4>
                            <p className="text-[8px] font-mono opacity-40 mt-0.5">
                              {d.createdAt?.toDate().toLocaleDateString() || 'Just now'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Welcome Footer / Tips section */}
                <div className="pt-6 border-t border-black/5 flex flex-col md:flex-row md:items-center justify-between text-[10px] text-zinc-400 font-medium">
                  <div className="flex items-center gap-2 mb-2 md:mb-0">
                    <Sparkles size={14} className="text-orange-500" />
                    <span>Tip: Double click the eraser tool to completely purge the canvas space.</span>
                  </div>
                  <span>Made for high precision pressure Stylus & S Pen.</span>
                </div>
              </div>
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
            className="absolute inset-0 bg-white z-[100] overflow-y-auto touch-auto px-6 py-12 md:px-20"
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
            className="absolute bottom-0 inset-x-0 bg-black text-white p-8 md:p-12 z-[110] rounded-t-[40px] shadow-[0_-20px_50px_rgba(0,0,0,0.3)] max-h-[80vh] overflow-y-auto touch-auto"
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

      {/* Landing welcome page */}
      <AnimatePresence>
        {showLanding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[150]"
          >
            <LandingPage
              user={user}
              onEnterCanvas={() => setShowLanding(false)}
              onOpenDashboard={() => {
                setShowLanding(false);
                setShowDashboard(true);
              }}
              onOpenGallery={() => {
                setShowLanding(false);
                setShowGallery(true);
              }}
              onSignIn={signIn}
              savedDrawingsCount={drawings.length}
              allowTouch={allowTouch}
              setAllowTouch={(val) => {
                setAllowTouch(val);
                setPenOnly(allowPen && !val && !allowMouse);
              }}
              simulationMode={simulationMode}
              setSimulationMode={setSimulationMode}
              pressureOffset={pressureOffset}
              setPressureOffset={setPressureOffset}
              pressureScale={pressureScale}
              setPressureScale={setPressureScale}
              focusMode={focusMode}
              setFocusModeExplicit={setFocusModeExplicit}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Right Unified Controls Header */}
      {!showGallery && !showDashboard && !showLanding && (
        <div className="absolute top-6 right-6 z-50 flex items-center gap-2 pointer-events-none">
          {/* Focus Mode Switch (Touch vs Pen toggle) */}
          <div className="flex items-center bg-white/85 backdrop-blur border border-black/10 p-1 rounded-full shadow-lg pointer-events-auto">
            <button
              onClick={() => setFocusModeExplicit('touch')}
              className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[9.5px] uppercase font-black tracking-wider transition-all duration-200 ${
                focusMode === 'touch'
                  ? 'bg-black text-white shadow-sm scale-102'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-black/5'
              }`}
              title="Switch Focus to touch and mouse control (Fingers / generic pens draw freely)"
            >
              <Hand size={11} />
              <span>Touch Focus</span>
            </button>
            <button
              onClick={() => setFocusModeExplicit('pen')}
              className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-[9.5px] uppercase font-black tracking-wider transition-all duration-200 ${
                focusMode === 'pen'
                  ? 'bg-black text-white shadow-sm scale-102'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-black/5'
              }`}
              title="Switch Focus to Pen drawing only (Disables touch to act as full hardware palm rejection)"
            >
              <Pencil size={11} />
              <span>Pen Focus</span>
            </button>
          </div>

          {/* Floating Toolbar Toggle Button */}
          <button
            onClick={() => setShowToolbar(!showToolbar)}
            className="w-10 h-10 bg-white/85 backdrop-blur border border-black/10 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 hover:bg-white pointer-events-auto"
            title="Toggle Drawing Toolbar"
          >
            <RotateCcw size={18} className={`transition-transform duration-500 ${showToolbar ? 'rotate-180' : 'rotate-0'}`} />
          </button>
        </div>
      )}

      {/* Canvas Stats Overlay */}
      {!showGallery && !showDashboard && !showLanding && (
        <CanvasStats
          layers={layers}
          currentStroke={currentStroke}
          isDrawing={isDrawing}
          workspaceSessionId={workspaceSessionId}
        />
      )}

      {/* Google Drive and Custom Picker System desk Overlay */}
      <AnimatePresence>
        {showDriveHub && (
          <GoogleDriveHub
            isOpen={showDriveHub}
            onClose={() => setShowDriveHub(false)}
            user={user}
            driveToken={driveToken}
            onConnectDrive={handleConnectDrive}
            onDisconnectDrive={handleDisconnectDrive}
            activeLayers={layers}
            activeDataUrl={getCanvasDataUrl()}
            loadedFileId={loadedDriveFileId}
            loadedFileName={loadedDriveFileName}
            onLoadWorkspace={handleLoadWorkspace}
            onImportBackgroundImage={handleImportBackgroundImage}
          />
        )}
      </AnimatePresence>

      {/* Workspace Hub (Gmail, Tasks, Keep) Overlay */}
      <AnimatePresence>
        {showWorkspaceHub && (
          <WorkspaceHub
            isOpen={showWorkspaceHub}
            onClose={() => setShowWorkspaceHub(false)}
            user={user}
            driveToken={driveToken}
            activeDataUrl={getCanvasDataUrl()}
            onReauthorize={handleConnectDrive}
          />
        )}
      </AnimatePresence>

      {/* Android S Pen Dev Hub (Gemini Active Vector Architect) Overlay */}
      <AnimatePresence>
        {showAndroidDevHub && (
          <AndroidDevHub
            isOpen={showAndroidDevHub}
            onClose={() => setShowAndroidDevHub(false)}
            activeDataUrl={getCanvasDataUrl()}
            layers={layers}
          />
        )}
      </AnimatePresence>

      {/* Save Status Toast Notification */}
      <AnimatePresence>
        {saveStatus !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
            style={{ x: '-50%' }}
            className={`fixed top-6 left-1/2 z-[250] max-w-sm w-[calc(100%-2rem)] sm:w-auto px-5 py-3 rounded-2xl flex items-center gap-3.5 shadow-[0_12px_45px_rgba(0,0,0,0.16)] border backdrop-blur-md transition-colors ${
              saveStatus === 'saving'
                ? 'bg-white/95 border-black/10 text-zinc-800'
                : saveStatus === 'success'
                ? 'bg-[#EBF7EE]/95 border-emerald-500/20 text-[#14532D]'
                : 'bg-red-50/95 border-red-500/20 text-[#7F1D1D]'
            }`}
          >
            {saveStatus === 'saving' && (
              <Loader2 className="animate-spin text-zinc-500 shrink-0" size={18} />
            )}
            {saveStatus === 'success' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-sm"
              >
                <Check size={12} strokeWidth={3} />
              </motion.div>
            )}
            {saveStatus === 'error' && (
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                <span className="font-extrabold text-[11px]">!</span>
              </div>
            )}
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {saveStatus === 'saving' ? 'Saving Drawing' : saveStatus === 'success' ? 'Drawing Saved' : 'Save Failed'}
              </span>
              <span className="text-[10px] text-zinc-500 font-medium -mt-0.5 leading-tight">
                {saveStatus === 'saving' 
                  ? 'Writing workspace data to cloud...' 
                  : saveStatus === 'success' 
                  ? 'Your sketch is now secured in your gallery.' 
                  : 'Check your network and try again.'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF Export Status Toast Notification */}
      <AnimatePresence>
        {pdfExportStatus !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
            style={{ x: '-50%' }}
            className={`fixed top-6 left-1/2 z-[250] max-w-sm w-[calc(100%-2rem)] sm:w-auto px-5 py-3 rounded-2xl flex items-center gap-3.5 shadow-[0_12px_45px_rgba(0,0,0,0.16)] border backdrop-blur-md transition-colors ${
              pdfExportStatus === 'exporting'
                ? 'bg-white/95 border-black/10 text-zinc-800'
                : pdfExportStatus === 'success'
                ? 'bg-[#EBF7EE]/95 border-emerald-500/20 text-[#14532D]'
                : 'bg-red-50/95 border-red-500/20 text-[#7F1D1D]'
            }`}
          >
            {pdfExportStatus === 'exporting' && (
              <Loader2 className="animate-spin text-zinc-500 shrink-0" size={18} />
            )}
            {pdfExportStatus === 'success' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-sm"
              >
                <Check size={12} strokeWidth={3} />
              </motion.div>
            )}
            {pdfExportStatus === 'error' && (
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white shrink-0 shadow-sm">
                <span className="font-extrabold text-[11px]">!</span>
              </div>
            )}
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {pdfExportStatus === 'exporting' ? 'Exporting PDF' : pdfExportStatus === 'success' ? 'PDF Exported' : 'Export Failed'}
              </span>
              <span className="text-[10px] text-zinc-500 font-medium -mt-0.5 leading-tight">
                {pdfExportStatus === 'exporting' 
                  ? 'Compiling layers and scaling artwork...' 
                  : pdfExportStatus === 'success' 
                  ? 'High-quality document saved and download started.' 
                  : 'Check your canvas data and try again.'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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

function ActionButton({ onClick, disabled, active, icon, title }: { onClick: () => void; disabled?: boolean; active?: boolean; icon: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded-xl transition-colors ${active ? 'bg-black text-white' : 'hover:bg-black/5 opacity-40 hover:opacity-100'} disabled:opacity-10 disabled:cursor-not-allowed`}
      title={title}
    >
      {icon}
    </button>
  );
}
