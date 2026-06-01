import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Pencil, 
  Sparkles, 
  User as UserIcon, 
  Layers, 
  Sliders, 
  Palette, 
  ArrowRight, 
  Grid2X2, 
  Zap, 
  Cloud,
  CheckCircle,
  Cpu,
  Hand
} from 'lucide-react';
import { User } from 'firebase/auth';

interface LandingPageProps {
  user: User | null;
  onEnterCanvas: () => void;
  onOpenDashboard: () => void;
  onOpenGallery: () => void;
  onSignIn: () => void;
  savedDrawingsCount: number;
  
  // Settings to hook up inside our sandbox calibrator
  allowTouch: boolean;
  setAllowTouch: (val: boolean) => void;
  simulationMode: 'constant' | 'velocity';
  setSimulationMode: (val: 'constant' | 'velocity') => void;
  pressureOffset: number;
  setPressureOffset: (val: number) => void;
  pressureScale: number;
  setPressureScale: (val: number) => void;
  focusMode: 'touch' | 'pen';
  setFocusModeExplicit: (val: 'touch' | 'pen') => void;
}

export default function LandingPage({
  user,
  onEnterCanvas,
  onOpenDashboard,
  onOpenGallery,
  onSignIn,
  savedDrawingsCount,
  allowTouch,
  setAllowTouch,
  simulationMode,
  setSimulationMode,
  pressureOffset,
  setPressureOffset,
  pressureScale,
  setPressureScale,
  focusMode,
  setFocusModeExplicit
}: LandingPageProps) {
  
  // Custom interactive sandbox canvas inside the landing page
  const sandboxCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [livePressure, setLivePressure] = useState(0.5);
  const [sandboxPointsCount, setSandboxPointsCount] = useState(0);
  const lastSandboxPointRef = useRef<{ x: number; y: number; t: number } | null>(null);

  // Clear sandbox stage
  const clearSandbox = () => {
    const canvas = sandboxCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSandboxPointsCount(0);
    }
  };

  // Resize landing sandbox canvas
  useEffect(() => {
    const canvas = sandboxCanvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight || 200;
    }
  }, []);

  // Handle pointer interactions on sandbox helper validation
  const isAllowedSandboxInput = (pointerType: string) => {
    if (focusMode === 'pen') {
      return pointerType === 'pen';
    } else {
      return pointerType === 'touch' || pointerType === 'mouse';
    }
  };

  // Handle pointer interactions on sandbox
  const handleSandboxDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isAllowedSandboxInput(e.pointerType)) return;
    const canvas = sandboxCanvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    lastSandboxPointRef.current = { x, y, t: Date.now() };

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    }
    setSandboxPointsCount(prev => prev + 1);
  };

  const handleSandboxMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if (!isAllowedSandboxInput(e.pointerType)) return;
    const canvas = sandboxCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const t = Date.now();

    let pressure = 0.5;
    if (e.pointerType === 'pen' && e.pressure > 0) {
      pressure = e.pressure;
    } else if (simulationMode === 'velocity' && lastSandboxPointRef.current) {
      const last = lastSandboxPointRef.current;
      const dx = x - last.x;
      const dy = y - last.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const dt = Math.max(1, t - last.t);
      const speed = dist / dt; // px per ms

      const maxSpeed = 3.5;
      const minPressure = 0.15;
      const maxPressure = 1.0;
      const ratio = Math.min(1, speed / maxSpeed);
      pressure = maxPressure - (maxPressure - minPressure) * ratio;
    }

    setLivePressure(pressure);

    const ctx = canvas.getContext('2d');
    if (ctx && lastSandboxPointRef.current) {
      ctx.beginPath();
      ctx.strokeStyle = '#000000';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const calculatedWidth = pressureOffset + pressureScale * pressure;
      ctx.lineWidth = calculatedWidth;
      
      ctx.moveTo(lastSandboxPointRef.current.x, lastSandboxPointRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    lastSandboxPointRef.current = { x, y, t };
    setSandboxPointsCount(prev => prev + 1);
  };

  const handleSandboxUp = () => {
    setIsDrawing(false);
    lastSandboxPointRef.current = null;
  };

  if (!user) {
    return (
      <div className="absolute inset-0 bg-[#FAF9F5] z-[150] overflow-y-auto select-none font-sans flex flex-col items-center justify-center p-4">
        {/* Dynamic Background Pattern */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{ 
            backgroundImage: 'radial-gradient(#000000 1.2px, transparent 1.2px)',
            backgroundSize: '24px 24px' 
          }}
        />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white border border-black/10 rounded-[32px] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.03)] w-full max-w-[480px] relative z-10 space-y-8 text-center"
        >
          {/* Logo element */}
          <div className="flex flex-col items-center space-y-3">
            <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-white font-black italic text-2xl shadow-lg hover:rotate-6 transition-transform">
              S
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-widest text-zinc-900 leading-none">S Pen Draw Pro</h1>
              <span className="text-[10px] font-mono text-zinc-400 tracking-wider block mt-1 uppercase">Creative Studio Workspace</span>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-zinc-800">
              Account Authentication
            </h2>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-sm mx-auto">
              Welcome to the S Pen Draw Creative Suite. Authenticate with your Google account secure session to unlock custom vectors, pressure emulation, and direct Google Drive cloud integrations.
            </p>
          </div>

          {/* Login Button with modern Google material design */}
          <div className="pt-2">
            <button 
              onClick={onSignIn} 
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-black hover:bg-neutral-900 text-white rounded-2xl font-bold uppercase text-[10.5px] tracking-wider transition-all shadow-md hover:translate-y-[-2px] active:translate-y-[1px] cursor-pointer"
            >
              <svg className="w-4.5 h-4.5 fill-current shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.82-2.5-1.18-5.12-.83-5.83z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
              <span>Sign In with Google</span>
            </button>
          </div>

          {/* Quick security highlight */}
          <div className="pt-6 border-t border-black/5 text-[8.5px] font-mono text-zinc-400 uppercase tracking-widest leading-loose">
            • Authorized Firebase SDK •<br />
            • Google Workspace Verified •
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-[#FAF9F5] z-[150] overflow-y-auto select-none touch-auto font-sans flex flex-col items-center">
      {/* Dynamic Background Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{ 
          backgroundImage: 'radial-gradient(#000000 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px' 
        }}
      />

      {/* Landing container */}
      <div className="w-full max-w-6xl mx-auto px-6 py-12 md:py-16 relative z-10 flex flex-col justify-between min-h-screen">
        
        {/* Header Branding */}
        <div className="flex items-center justify-between border-b border-black/5 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center text-white font-black italic text-lg shadow-md">
              S
            </div>
            <div>
              <h1 className="text-sm font-black uppercase tracking-widest text-zinc-900 leading-none">S Pen Draw</h1>
              <span className="text-[8px] font-mono text-zinc-400 tracking-wider">CREATIVE STUDIO PRO</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2 pr-1">
                <span className="text-[9.5px] font-mono opacity-50 uppercase tracking-wider hidden sm:inline">Linked:</span>
                <div 
                  onClick={onOpenDashboard}
                  className="flex items-center gap-2 bg-white border border-black/10 px-3 py-1.5 rounded-full cursor-pointer hover:bg-zinc-50 transition-colors"
                >
                  <img src={user.photoURL || ''} className="w-5 h-5 rounded-full border border-black/10" alt="avatar" />
                  <span className="text-[10px] font-bold uppercase truncate max-w-[90px]">{user.displayName}</span>
                </div>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="text-[9.5px] font-bold uppercase tracking-wider text-zinc-600 hover:text-black hover:underline transition-colors px-1"
              >
                Sign In Sync
              </button>
            )}

            <button
              onClick={onOpenDashboard}
              className="px-4 py-1.5 border border-black/10 hover:border-black text-[10px] uppercase font-bold tracking-wider rounded-full bg-white transition-all shadow-sm"
            >
              Control Panel
            </button>
          </div>
        </div>

        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 my-12 items-center">
          
          {/* Hero Pitch */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full border border-amber-200/50">
              <Sparkles size={11} className="text-amber-500" />
              <span className="text-[9px] font-mono text-amber-700 font-extrabold uppercase tracking-widest">Active Stylus Mapping Engine</span>
            </div>

            <div className="space-y-3">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-zinc-950 tracking-tighter uppercase leading-none italic">
                S Pen <br className="hidden md:inline" />
                <span className="text-zinc-600">Drawing Studio</span>
              </h2>
              <p className="text-xs md:text-sm text-zinc-500 leading-relaxed font-medium max-w-xl">
                Experience high-fidelity, ultra-responsive drawing tailored strictly for Samsung S Pens, active digital styluses, and smart tactile triggers. Enjoy sub-pixel precision and velocity-emulated fingers on an expressive interactive canvas.
              </p>
            </div>

            {/* Quick CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={onEnterCanvas}
                className="px-8 py-4 bg-black text-white hover:bg-zinc-800 rounded-2xl font-bold uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl hover:translate-y-[-2px] active:translate-y-[1px]"
              >
                <span>Launch Draw Studio</span>
                <ArrowRight size={14} />
              </button>
              
              <button
                onClick={onOpenGallery}
                className="px-8 py-4 bg-white/85 hover:bg-white text-zinc-800 border border-black/10 hover:border-black/30 rounded-2xl font-bold uppercase text-[11px] tracking-widest flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <Grid2X2 size={13} />
                <span>Gallery ({savedDrawingsCount || 0})</span>
              </button>
            </div>

            {/* Quick Status Info */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-black/5">
              <div className="space-y-1">
                <span className="text-[8px] font-mono opacity-40 uppercase tracking-widest block">Core Runtime</span>
                <span className="text-[11px] font-extrabold uppercase tracking-tight text-zinc-800">HTML5 Pointer Events</span>
              </div>
              <div className="space-y-1 border-l border-black/5 pl-4">
                <span className="text-[8px] font-mono opacity-40 uppercase tracking-widest block">Input Hardware</span>
                <span className="text-[11px] font-extrabold uppercase tracking-tight text-zinc-800">Multi-Touch & Pen</span>
              </div>
              <div className="space-y-1 border-l border-black/5 pl-4">
                <span className="text-[8px] font-mono opacity-40 uppercase tracking-widest block">Backup Syncing</span>
                <span className="text-[11px] font-extrabold uppercase tracking-tight text-zinc-800">Cloud Firestore</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Interactive Scratchpad Sandbox (Tactile Craft Integration) */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-black/10 rounded-[32px] p-6 shadow-2xl relative overflow-hidden flex flex-col justify-between space-y-4">
              
              {/* Scratchpad Header */}
              <div className="flex items-center justify-between border-b border-black/5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Tactile Diagnostic Sandbox</span>
                </div>
                <button
                  onClick={clearSandbox}
                  className="text-[8px] font-mono uppercase bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded transition-colors text-zinc-600"
                >
                  Clear Sketch
                </button>
              </div>

              {/* Real interactive scratchpad space */}
              <div className="relative h-48 bg-[#FDFDFB] border border-black/5 rounded-2xl overflow-hidden cursor-crosshair">
                {sandboxPointsCount === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 pointer-events-none opacity-40">
                    <Pencil size={18} className="mb-2 text-zinc-400" />
                    <p className="text-[10px] font-extrabold uppercase tracking-tight text-zinc-700">Test Your Stylus / Touch Here</p>
                    <p className="text-[8px] font-mono text-zinc-400 mt-1 max-w-[200px] leading-relaxed">
                      Draw inside this box to check live formula pressure outputs instantly.
                    </p>
                  </div>
                )}

                <canvas
                  ref={sandboxCanvasRef}
                  onPointerDown={handleSandboxDown}
                  onPointerMove={handleSandboxMove}
                  onPointerUp={handleSandboxUp}
                  onPointerLeave={handleSandboxUp}
                  className="absolute inset-0 block touch-none"
                  style={{ touchAction: 'none' }}
                />

                {/* Live pressure indicator bubble inside the sandbox */}
                {isDrawing && (
                  <div className="absolute bottom-2 left-2 bg-black text-white px-2 py-0.5 rounded font-mono text-[8px] uppercase tracking-wider flex items-center gap-1.5 shadow">
                    <span>Pressure:</span>
                    <span className="font-extrabold">{(livePressure * 100).toFixed(0)}%</span>
                  </div>
                )}
              </div>

              {/* Calibration controls mapped strictly to original states */}
              <div className="space-y-3 bg-zinc-50 p-4 rounded-2xl border border-black/5">
                <div className="flex items-center justify-between">
                  <span className="text-[9.5px] font-bold uppercase tracking-tight text-zinc-800">Pressure Emulation Setup</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setSimulationMode('velocity')}
                      className={`px-2 py-0.5 font-mono text-[8px] rounded uppercase font-bold transition-all ${simulationMode === 'velocity' ? 'bg-black text-white' : 'bg-white border border-black/10 text-zinc-500'}`}
                    >
                      Velocity
                    </button>
                    <button
                      onClick={() => setSimulationMode('constant')}
                      className={`px-2 py-0.5 font-mono text-[8px] rounded uppercase font-bold transition-all ${simulationMode === 'constant' ? 'bg-black text-white' : 'bg-white border border-black/10 text-zinc-500'}`}
                    >
                      Constant
                    </button>
                  </div>
                </div>

                {/* Manual Focus Toggle Option */}
                <div className="pt-2.5 border-t border-black/5 space-y-2">
                  <div className="flex justify-between items-center text-[9.5px] font-bold uppercase text-zinc-800">
                    <span>Input Focus Mode</span>
                    <span className="text-[8px] font-mono text-zinc-400 font-normal">Sandbox Diagnostic</span>
                  </div>
                  <div className="bg-white p-1 rounded-xl flex border border-black/5 gap-1">
                    <button
                      onClick={() => setFocusModeExplicit('touch')}
                      className={`flex-1 py-1 px-2 rounded-lg text-[8.5px] font-black uppercase transition-all duration-150 flex items-center justify-center gap-1 ${
                        focusMode === 'touch'
                          ? 'bg-black text-white'
                          : 'text-zinc-500 hover:bg-neutral-100'
                      }`}
                    >
                      <Hand size={10} />
                      Touch focus
                    </button>
                    <button
                      onClick={() => setFocusModeExplicit('pen')}
                      className={`flex-1 py-1 px-2 rounded-lg text-[8.5px] font-black uppercase transition-all duration-150 flex items-center justify-center gap-1 ${
                        focusMode === 'pen'
                          ? 'bg-black text-white'
                          : 'text-zinc-500 hover:bg-neutral-100'
                      }`}
                    >
                      <Pencil size={10} />
                      Pen focus
                    </button>
                  </div>
                </div>

                {/* Mini Formula Display */}
                <div className="font-mono text-[8px] bg-white border border-black/5 p-2 rounded text-zinc-600 leading-normal flex flex-col">
                  <span className="text-zinc-400 text-[7px] uppercase tracking-wider">Active Formula:</span>
                  <span className="text-black font-semibold mt-0.5">
                    BrushWidth = {pressureOffset.toFixed(1)} + {pressureScale.toFixed(1)} * Pressure
                  </span>
                </div>

                {/* Live Sliders */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-black/5">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-mono">
                      <span>Offset</span>
                      <span className="font-extrabold text-zinc-800">{pressureOffset.toFixed(1)}</span>
                    </div>
                    <input 
                      type="range"
                      min="0.1"
                      max="8.0"
                      step="0.1"
                      value={pressureOffset}
                      onChange={(e) => setPressureOffset(parseFloat(e.target.value))}
                      className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-black"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-mono">
                      <span>Scale</span>
                      <span className="font-extrabold text-zinc-800">+{pressureScale.toFixed(1)}</span>
                    </div>
                    <input 
                      type="range"
                      min="0.0"
                      max="20.0"
                      step="0.1"
                      value={pressureScale}
                      onChange={(e) => setPressureScale(parseFloat(e.target.value))}
                      className="w-full h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-black"
                    />
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>

        {/* Feature Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          
          <div className="bg-white border border-black/5 hover:border-black/10 hover:shadow-lg transition-all p-6 rounded-2xl space-y-3">
            <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shadow-sm">
              <Sliders size={16} />
            </div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-tight text-zinc-850">Stylus V-Sensing</h4>
            <p className="text-[10px] text-zinc-400 leading-relaxed font-mono">
              Adjust Offset and Scale multiplier mapping formulas. Build custom brush strokes reflecting true active hardware pressure.
            </p>
          </div>

          <div className="bg-white border border-black/5 hover:border-black/10 hover:shadow-lg transition-all p-6 rounded-2xl space-y-3">
            <div className="w-8 h-8 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center text-green-600 shadow-sm">
              <Zap size={16} />
            </div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-tight text-zinc-850">Emulated Velocity</h4>
            <p className="text-[10px] text-zinc-400 leading-relaxed font-mono">
              No stylus? No problem. Touch paths calculate drawing velocity smoothly—making faster sweeps thinner, slower holds juicy.
            </p>
          </div>

          <div className="bg-white border border-black/5 hover:border-black/10 hover:shadow-lg transition-all p-6 rounded-2xl space-y-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm">
              <Layers size={16} />
            </div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-tight text-zinc-850">Drafting Layers</h4>
            <p className="text-[10px] text-zinc-400 leading-relaxed font-mono">
              Build compositions with high-fidelity layers. Customize overlay opacity levels, layer sequence, and show/hide parameters freely.
            </p>
          </div>

          <div className="bg-white border border-black/5 hover:border-black/10 hover:shadow-lg transition-all p-6 rounded-2xl space-y-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/50 flex items-center justify-center text-amber-600 shadow-sm">
              <Sparkles size={16} />
            </div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-tight text-zinc-850">Gemini Suggestion Drawer</h4>
            <p className="text-[10px] text-zinc-400 leading-relaxed font-mono">
              Submit your master drafts directly to the integrated multimodal Gemini API for instant ideas, critiques, and creative expansions.
            </p>
          </div>

        </div>

        {/* Footer Brand Info */}
        <div className="border-t border-black/5 pt-6 flex flex-col md:flex-row items-center justify-between text-[9px] font-mono text-zinc-400 uppercase tracking-widest gap-4">
          <span>Active Stylus Professional • HTML5 Pointer Events Standards</span>
          <span>© 2026 S PEN STUDIO INC. CLOUD WORKSPACE</span>
        </div>

      </div>
    </div>
  );
}
