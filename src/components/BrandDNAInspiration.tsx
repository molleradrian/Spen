import React, { useState } from 'react';
import { 
  Palette, 
  Layers, 
  Sparkles, 
  Download, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  Pencil, 
  Eraser, 
  Sliders, 
  FileText, 
  Check, 
  Loader2,
  Briefcase,
  Share2,
  Copy
} from 'lucide-react';
import { DrawingLayer, Client, Project, TaskItem } from '../types';

interface BrandDNAInspirationProps {
  client: Client | null;
  project: Project | null;
  activeTask: TaskItem | null;
  layers: DrawingLayer[];
  activeLayerId: string;
  currentColor: string;
  brushSize: number;
  brushMode: 'draw' | 'erase' | 'pencil' | 'marker' | 'airbrush';
  opacity: number;
  pressureMultiplier: number;
  onSelectColor: (color: string) => void;
  onChangeBrushSize: (size: number) => void;
  onChangeBrushMode: (mode: 'draw' | 'erase' | 'pencil' | 'marker' | 'airbrush') => void;
  onChangeOpacity: (opacity: number) => void;
  onChangePressureMultiplier: (mult: number) => void;
  onSelectLayer: (layerId: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: (layerId: string) => void;
  onToggleLayerVisibility: (layerId: string) => void;
  onChangeLayerOpacity: (layerId: string, opacity: number) => void;
  onUpdateClientBrandDNA: (brandDNA: string) => void;
  onExportPNG: () => void;
  onExportJPG: () => void;
  onExportPDF: () => void;
}

export const BrandDNAInspiration: React.FC<BrandDNAInspirationProps> = ({
  client,
  project,
  activeTask,
  layers,
  activeLayerId,
  currentColor,
  brushSize,
  brushMode,
  opacity,
  pressureMultiplier,
  onSelectColor,
  onChangeBrushSize,
  onChangeBrushMode,
  onChangeOpacity,
  onChangePressureMultiplier,
  onSelectLayer,
  onAddLayer,
  onDeleteLayer,
  onToggleLayerVisibility,
  onChangeLayerOpacity,
  onUpdateClientBrandDNA,
  onExportPNG,
  onExportJPG,
  onExportPDF
}) => {
  const [activeTab, setActiveTab] = useState<'brushes' | 'layers' | 'ai' | 'export'>('brushes');

  // Gemini AI state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiPromptResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Client Brand DNA local state
  const [brandDnaInput, setBrandDnaInput] = useState(client?.brandDNA || '');

  // Canon Palette
  const CANON_PALETTE = [
    { name: 'MAX ENTROPY', color: '#610061' },
    { name: 'MIN ENTROPY', color: '#ff0000' },
    { name: 'QUANTUM BLUE', color: '#007aff' },
    { name: 'KINETIC GREEN', color: '#617700' },
    { name: 'CYAN', color: '#00E5CC' },
    { name: 'BLACK', color: '#000000' },
    { name: 'WHITE', color: '#FFFFFF' },
    { name: 'AMBER', color: '#F59E0B' }
  ];

  const handleGenerateInspiration = async () => {
    setIsAiLoading(true);
    setAiPromptResponse(null);
    try {
      const res = await fetch('/api/gemini/brand-inspiration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandDNA: client?.brandDNA || brandDnaInput,
          projectBrief: project?.brief,
          taskName: activeTask?.taskName,
          prompt: aiPrompt || 'Generate 3 creative artwork ideas and color suggestions.'
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiPromptResponse(data.text || 'No inspiration output received.');
    } catch (err: any) {
      setAiPromptResponse(`Inspiration Error: ${err.message || String(err)}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#080A12] border-l border-white/10 select-none overflow-hidden font-mono text-xs">
      {/* Tab Header Bar */}
      <div className="grid grid-cols-4 border-b border-white/10 bg-zinc-950/80 p-1.5 gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('brushes')}
          className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-[10px] tracking-wider uppercase transition-all ${
            activeTab === 'brushes' 
              ? 'bg-[#610061]/40 text-purple-200 border border-[#610061]' 
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Palette size={14} />
          <span>Brushes</span>
        </button>

        <button
          onClick={() => setActiveTab('layers')}
          className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-[10px] tracking-wider uppercase transition-all ${
            activeTab === 'layers' 
              ? 'bg-[#007aff]/30 text-blue-200 border border-[#007aff]' 
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Layers size={14} />
          <span>Layers ({layers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-[10px] tracking-wider uppercase transition-all ${
            activeTab === 'ai' 
              ? 'bg-amber-950/40 text-amber-200 border border-amber-500/50' 
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sparkles size={14} className="text-amber-400" />
          <span>AI Engine</span>
        </button>

        <button
          onClick={() => setActiveTab('export')}
          className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 font-bold text-[10px] tracking-wider uppercase transition-all ${
            activeTab === 'export' 
              ? 'bg-emerald-950/40 text-emerald-200 border border-emerald-500/50' 
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Download size={14} />
          <span>Export</span>
        </button>
      </div>

      {/* Tab Content Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* TAB 1: BRUSHES & CANON PALETTE */}
        {activeTab === 'brushes' && (
          <div className="space-y-5">
            {/* Canon Color Swatches */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block">
                BaNano Canon Palette
              </span>
              <div className="grid grid-cols-4 gap-2">
                {CANON_PALETTE.map(c => (
                  <button
                    key={c.color}
                    onClick={() => onSelectColor(c.color)}
                    style={{ backgroundColor: c.color }}
                    className={`h-9 rounded-xl border flex items-center justify-center transition-all ${
                      currentColor.toLowerCase() === c.color.toLowerCase()
                        ? 'border-white scale-105 shadow-[0_0_12px_rgba(255,255,255,0.6)]'
                        : 'border-white/20 hover:scale-100'
                    }`}
                    title={c.name}
                  >
                    {currentColor.toLowerCase() === c.color.toLowerCase() && (
                      <Check size={14} className={c.color === '#FFFFFF' ? 'text-black' : 'text-white'} />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[9px] text-zinc-500 uppercase">Custom Color</span>
                <input
                  type="color"
                  value={currentColor}
                  onChange={(e) => onSelectColor(e.target.value)}
                  className="w-8 h-6 bg-transparent border-0 cursor-pointer"
                />
              </div>
            </div>

            {/* Brush Mode Picker */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block">
                S Pen Brush Tool
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(['draw', 'pencil', 'marker', 'airbrush', 'erase'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => onChangeBrushMode(mode)}
                    className={`py-2 px-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                      brushMode === mode
                        ? 'bg-white text-black border-white shadow'
                        : 'bg-zinc-950 text-zinc-300 border-white/10 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Brush Sliders */}
            <div className="space-y-4 bg-zinc-950 p-3 rounded-2xl border border-white/10">
              {/* Size Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-300 font-bold">
                  <span>Stroke Size</span>
                  <span>{brushSize}px</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={brushSize}
                  onChange={(e) => onChangeBrushSize(Number(e.target.value))}
                  className="w-full accent-[#00E5CC]"
                />
              </div>

              {/* Pressure Multiplier */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-300 font-bold">
                  <span>S Pen Pressure Multiplier</span>
                  <span>{pressureMultiplier}x</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.1}
                  value={pressureMultiplier}
                  onChange={(e) => onChangePressureMultiplier(Number(e.target.value))}
                  className="w-full accent-[#007aff]"
                />
              </div>

              {/* Opacity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-300 font-bold">
                  <span>Stroke Opacity</span>
                  <span>{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={opacity}
                  onChange={(e) => onChangeOpacity(Number(e.target.value))}
                  className="w-full accent-[#610061]"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LAYERS CONTROL */}
        {activeTab === 'layers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                Drawing Layers
              </span>
              <button
                onClick={onAddLayer}
                className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-[#00E5CC] hover:underline"
              >
                <Plus size={12} />
                <span>Add Layer</span>
              </button>
            </div>

            <div className="space-y-2">
              {layers.map(layer => (
                <div
                  key={layer.id}
                  onClick={() => onSelectLayer(layer.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                    activeLayerId === layer.id
                      ? 'bg-[#007aff]/20 border-[#007aff] text-white shadow'
                      : 'bg-zinc-950 border-white/10 text-zinc-300 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{layer.name}</span>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onToggleLayerVisibility(layer.id)}
                        className="text-zinc-400 hover:text-white p-1"
                        title="Toggle Visibility"
                      >
                        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} className="text-red-400" />}
                      </button>
                      {layers.length > 1 && (
                        <button
                          onClick={() => onDeleteLayer(layer.id)}
                          className="text-zinc-400 hover:text-red-400 p-1"
                          title="Delete Layer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Layer Opacity Slider */}
                  <div className="flex items-center gap-2 pt-1 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[9px] text-zinc-500 uppercase">Opacity</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={layer.opacity}
                      onChange={(e) => onChangeLayerOpacity(layer.id, Number(e.target.value))}
                      className="w-full accent-[#007aff]"
                    />
                    <span className="text-[9px] font-mono text-zinc-400 font-bold w-8 text-right">
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: BRAND DNA & GEMINI AI INSPIRATION */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            {/* Client Brand DNA Section */}
            <div className="space-y-2 bg-zinc-950 p-3 rounded-2xl border border-white/10">
              <span className="text-[10px] font-bold uppercase text-amber-400 tracking-wider block">
                Client Brand DNA
              </span>
              <textarea
                rows={3}
                value={brandDnaInput}
                onChange={(e) => setBrandDnaInput(e.target.value)}
                placeholder="Enter client aesthetic guidelines, brand colors, target audience tone..."
                className="w-full bg-zinc-900 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={() => onUpdateClientBrandDNA(brandDnaInput)}
                className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 font-bold text-[10px] uppercase rounded-lg border border-amber-500/20"
              >
                Save Brand DNA
              </button>
            </div>

            {/* Gemini Inspiration Generator */}
            <div className="space-y-2 bg-gradient-to-b from-[#610061]/20 to-zinc-950 p-3 rounded-2xl border border-purple-500/30">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-300 animate-bounce" />
                <span className="text-xs font-extrabold uppercase text-purple-300 tracking-wider">
                  Gemini Inspiration Engine
                </span>
              </div>

              <textarea
                rows={3}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ask Gemini for design concepts, task ideas, color palettes..."
                className="w-full bg-zinc-950 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-400"
              />

              <button
                onClick={handleGenerateInspiration}
                disabled={isAiLoading}
                className="w-full py-2 bg-gradient-to-r from-[#610061] to-[#007aff] hover:opacity-90 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow disabled:opacity-50"
              >
                {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>{isAiLoading ? 'Synthesizing Ideas...' : 'Generate Inspiration'}</span>
              </button>
            </div>

            {/* Gemini Response Display */}
            {aiResponse && (
              <div className="p-3 bg-zinc-950 rounded-2xl border border-white/10 space-y-1.5">
                <span className="text-[9px] font-mono uppercase text-emerald-400 font-bold block">
                  Gemini Art Direction Output
                </span>
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
                  {aiResponse}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: EXPORT SUITE */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block">
              Export Artwork & Task Files
            </span>

            <div className="space-y-2">
              <button
                onClick={onExportPNG}
                className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-900 border border-white/10 hover:border-[#00E5CC] text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Download size={14} className="text-[#00E5CC]" />
                <span>Export High-Res PNG</span>
              </button>

              <button
                onClick={onExportJPG}
                className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-900 border border-white/10 hover:border-[#007aff] text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Download size={14} className="text-[#007aff]" />
                <span>Export JPG Image</span>
              </button>

              <button
                onClick={onExportPDF}
                className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-900 border border-white/10 hover:border-purple-400 text-white font-bold text-xs uppercase rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <FileText size={14} className="text-purple-400" />
                <span>Export PDF Document</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
