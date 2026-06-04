import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Code, 
  Smartphone, 
  Check, 
  Copy, 
  Loader2, 
  Sparkles, 
  Cpu, 
  Bot, 
  BookOpen, 
  Send,
  Info
} from 'lucide-react';

interface AndroidDevHubProps {
  isOpen: boolean;
  onClose: () => void;
  activeDataUrl: string;
  layers: any[]; // DrawingLayer format for precise coordinate-based code synthesis
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export default function AndroidDevHub({
  isOpen,
  onClose,
  activeDataUrl,
  layers
}: AndroidDevHubProps) {
  const [activeTab, setActiveTab] = useState<'copilot' | 'canvas-coder' | 'sdk-advisor'>('canvas-coder');
  
  // Tab 1: AI Copilot Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: "Hi! I am your Android Framework & Samsung S Pen SDK Copilot. Ask me anything about custom-built drawing canvases, S Pen SDK integrations, stylus hardware status, pointer events, pressure values, or accelerometer triggers."
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Tab 2: Code Gen state
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'compose' | 'customview'>('compose');
  const [copiedCode, setCopiedCode] = useState(false);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  useEffect(() => {
    if (isOpen && activeTab === 'canvas-coder' && !generatedCode) {
      // Auto-trigger canvas coding if they open the coder tab and they have drawings
      const totalStrokes = layers.reduce((acc, l) => acc + (l.strokes?.length || 0), 0);
      if (totalStrokes > 0) {
        generateAndroidCode(selectedLanguage);
      }
    }
  }, [isOpen, activeTab, layers]);

  if (!isOpen) return null;

  // Render S Pen insertion/removal checklist and accelerometer facts
  const sPenFaqs = [
    {
      title: "How to Detect S Pen Status (Insertion or Removal)",
      content: `In the Samsung S Pen SDK and standard Android Framework, physical insertion/removal of the stylus triggers an Android broadcast intent:

ACTION: "com.samsung.pen.INSERT"
EXTRA KEY: "penInsert" (Boolean: true = inserted, false = removed)

To listen for S Pen insertion, register a BroadcastReceiver in your AndroidManifest.xml or programmatically:

\`\`\`kotlin
val intentFilter = IntentFilter("com.samsung.pen.INSERT")
registerReceiver(object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val isInserted = intent.getBooleanExtra("penInsert", true)
        if (isInserted) {
            Log.d("SPen", "S Pen is inserted back into device slot")
        } else {
            Log.d("SPen", "S Pen is removed - start stylus listeners")
        }
    }
}, intentFilter)
\`\`\`
`
    },
    {
      title: "Stylus Type & Pressure Estimation",
      content: `Standard touch screens deliver finger touch events, but styluses report precise tool details. To check if an event is from a S Pen, inspect the \`toolType\` on \`MotionEvent\`:

\`\`\`kotlin
override fun onTouchEvent(event: MotionEvent): Boolean {
    val toolType = event.getToolType(0)
    val isPen = toolType == MotionEvent.TOOL_TYPE_STYLUS
    val isEraser = toolType == MotionEvent.TOOL_TYPE_ERASER // Samsung S Pen Side button erasing

    // Capture standard high-fidelity hardware stylus pressure (0.0 to 1.0+)
    val pressure = event.getPressure() 
    
    when (event.action) {
        MotionEvent.ACTION_DOWN -> { /* ... */ }
        MotionEvent.ACTION_MOVE -> { /* ... */ }
    }
    return true
}
\`\`\`
`
    },
    {
      title: "Does S Pen SDK utilize Device Accelerometers?",
      content: `Yes! Samsung Air Actions (Bluetooth LE gestures like flicking, circles, or shaking the pen in mid-air) are detected via **6-axis motion sensors (gyroscope and accelerometer)** built inside the S Pen itself.

1. **Air Action BLE Broadcast**: When physical pen movement is made, the stylus accelerometers send raw delta vectors to the device host over Bluetooth LE.
2. **Device Display Refresh Boost**: In the Android framework, rapid motion coordinates from stylus pointer moves or acceleration updates trigger a momentary display latency override. The kernel boosts the display panel immediately to its peak variable refresh rate (e.g., **120Hz refresh Rate / Samsung LTPO screen burst**) to achieve ultra-low drawing latency (down to 2.8ms on premium Samsung devices).
3. **Variable Core Temperature & Power Output**: Fast, highly continuous sensor polling (polling at 200Hz+ frequency) increases the CPU frequency governor, raising the device power curve and active core temperatures slightly.
`
    }
  ];

  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatSending) return;
    const userText = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsChatSending(true);

    try {
      const response = await fetch('/api/gemini/android-developer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode: 'chat',
          prompt: userText,
          imageData: activeDataUrl,
          layersSummary: formatLayersSummary(layers)
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gemini Copilot is unavailable');
      }

      setChatMessages(prev => [...prev, { role: 'model', text: data.text }]);
    } catch (err: any) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'model', text: `Sorry, I encountered an issue: ${err.message || "Please check your network and try again."}` }]);
    } finally {
      setIsChatSending(false);
    }
  };

  const generateAndroidCode = async (lang: 'compose' | 'customview') => {
    setIsGeneratingCode(true);
    setGeneratedCode('');
    try {
      const response = await fetch('/api/gemini/android-developer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mode: 'code-gen',
          language: lang,
          imageData: activeDataUrl,
          layersSummary: formatLayersSummary(layers)
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate code');
      }

      setGeneratedCode(data.text);
    } catch (err: any) {
      console.error(err);
      setGeneratedCode(`// Code generation error.\n// Detail: ${err.message || 'Please paint some drawings and trigger generation again.'}`);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const formatLayersSummary = (layersList: any[]) => {
    return layersList.map((l, index) => {
      const strokeCount = l.strokes?.length || 0;
      const pointCount = l.strokes?.reduce((sum: number, s: any) => sum + (s.points?.length || 0), 0) || 0;
      return `Layer ${index + 1} (${l.name}): ${strokeCount} strokes, ${pointCount} total coordinates, opacity: ${l.opacity}, visible: ${l.visible}`;
    }).join('\n');
  };

  const copyToClipboard = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 border border-white/10 text-white w-full max-w-6xl h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl font-sans"
      >
        {/* Header Section */}
        <div className="flex items-center justify-between border-b border-white/15 px-6 py-4 bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-emerald-400 border border-white/10 shadow-inner">
              <Smartphone size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-widest uppercase flex items-center gap-2">
                Gemini Android S Pen Dev Hub
                <span className="bg-emerald-500/10 text-emerald-400 text-[8px] font-mono px-1.5 py-0.5 rounded-md uppercase border border-emerald-500/20">AI Grounded</span>
              </h2>
              <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest">Hardware Stylus SDK, Accelerometers, & Compose Canvas Vector Generation</p>
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
        <div className="grid grid-cols-3 border-b border-white/10 bg-zinc-950/50 p-2 gap-2">
          <button
            onClick={() => setActiveTab('canvas-coder')}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase text-[11px] tracking-wider transition-all/300 ${
              activeTab === 'canvas-coder' 
                ? 'bg-zinc-805 bg-emerald-950/30 text-emerald-400 border border-emerald-500/20 shadow' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Code size={14} className="text-emerald-500" />
            Canvas Code Architect
          </button>

          <button
            onClick={() => setActiveTab('copilot')}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase text-[11px] tracking-wider transition-all/300 ${
              activeTab === 'copilot' 
                ? 'bg-zinc-805 bg-purple-950/30 text-purple-400 border border-purple-500/20 shadow' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <Bot size={14} className="text-purple-500" />
            Android & Hardware Chat
          </button>

          <button
            onClick={() => setActiveTab('sdk-advisor')}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase text-[11px] tracking-wider transition-all/300 ${
              activeTab === 'sdk-advisor' 
                ? 'bg-zinc-805 bg-blue-950/30 text-blue-400 border border-blue-500/20 shadow' 
                : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            <BookOpen size={14} className="text-blue-500" />
            Hardware Stylus FAQ
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-hidden bg-zinc-950/10">
          <AnimatePresence mode="wait">
            
            {/* Tab: Canvas Code Architect */}
            {activeTab === 'canvas-coder' && (
              <motion.div
                key="canvas-coder-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="h-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden"
              >
                {/* Controller Panel */}
                <div className="lg:col-span-4 border-r border-white/10 p-6 overflow-y-auto space-y-6 bg-zinc-950/20 text-left">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Kotlin Vector Converter</h3>
                    <p className="text-[10px] uppercase font-mono text-zinc-500 tracking-wider">Compiles drawing coordinates into native Android code</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest block mb-2">Android Framework Target</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setSelectedLanguage('compose');
                            generateAndroidCode('compose');
                          }}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                            selectedLanguage === 'compose'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white'
                          }`}
                        >
                          Jetpack Compose Canvas
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLanguage('customview');
                            generateAndroidCode('customview');
                          }}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition-all ${
                            selectedLanguage === 'customview'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-zinc-900 border-white/5 text-zinc-400 hover:text-white'
                          }`}
                        >
                          Kotlin Custom View
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-zinc-950/60 rounded-2xl border border-white/5 space-y-3">
                      <h4 className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Info size={12} className="text-emerald-500" />
                        Canvas State Summary
                      </h4>
                      <p className="text-[10px] text-zinc-400 leading-relaxed">
                        Gemini analyzes S Pen pointer coordinates, stroke shapes, active layers, and stroke pressure indices in the current drawing viewport, and matches them with Android UI drawing APIs contextually.
                      </p>
                      
                      <div className="pt-1.5 border-t border-white/5 text-[9px] font-mono text-zinc-500 uppercase tracking-wide space-y-1">
                        <div>Active Layers: {layers.length}</div>
                        <div>Strokes mapped: {layers.reduce((acc, l) => acc + (l.strokes?.length || 0), 0)}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => generateAndroidCode(selectedLanguage)}
                      disabled={isGeneratingCode}
                      className="w-full h-11 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold uppercase text-xs tracking-wider transition-all rounded-xl disabled:opacity-40"
                    >
                      {isGeneratingCode ? (
                        <>
                          <Loader2 size={14} className="animate-spin text-black" />
                          <span>Synthesizing Code...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          <span>Synthesize Android Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Display Output Code Panel */}
                <div className="lg:col-span-8 flex flex-col h-full bg-zinc-950/40 relative">
                  <div className="flex justify-between items-center px-6 py-3 border-b border-white/15 bg-zinc-950/60">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                      {selectedLanguage === 'compose' ? 'DrawingCanvas.kt (Jetpack Compose View)' : 'SPenCanvasView.kt (Core Framework View)'}
                    </span>
                    <button
                      onClick={copyToClipboard}
                      disabled={!generatedCode}
                      className="flex items-center gap-1.5 py-1 px-3 bg-zinc-900 border border-white/10 hover:border-white/20 hover:bg-zinc-850 rounded-lg text-xs font-medium text-zinc-300 hover:text-white transition-all disabled:opacity-30"
                    >
                      {copiedCode ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex-1 p-6 overflow-auto font-mono text-xs text-zinc-300 text-left select-text bg-[#0D0D11]">
                    {isGeneratingCode ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
                        <Loader2 className="animate-spin text-emerald-400" size={32} />
                        <div>
                          <p className="text-xs uppercase tracking-widest font-bold text-zinc-300">Formulating Canvas Vector Arrays</p>
                          <p className="text-[10px] text-zinc-500 mt-1 max-w-sm">Generating Kotlin canvas graphics bindings, drawing paths, and pressure sensitive modifiers...</p>
                        </div>
                      </div>
                    ) : generatedCode ? (
                      <pre className="whitespace-pre">{generatedCode}</pre>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <Code size={36} className="text-zinc-700 mb-2 animate-pulse" />
                        <h4 className="text-xs uppercase font-extrabold text-zinc-500">Workspace is empty</h4>
                        <p className="text-[10px] text-zinc-400 max-w-sm mt-1 leading-relaxed">
                          Sketch shapes on the viewport, select layers, and click "Synthesize Android Code" to instantly build native Android S Pen layouts.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab: AI Chat Copilot */}
            {activeTab === 'copilot' && (
              <motion.div
                key="copilot-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="h-full flex flex-col overflow-hidden"
              >
                {/* Chat Message Scroll */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex gap-3.5 max-w-4xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse text-right' : 'mr-auto text-left'}`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                        msg.role === 'user'
                          ? 'bg-zinc-800 text-white border-white/10'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      }`}>
                        {msg.role === 'user' ? <Smartphone size={14} /> : <Bot size={14} />}
                      </div>
                      <div className={`p-4 rounded-2xl max-w-2xl border text-xs leading-relaxed font-sans ${
                        msg.role === 'user'
                          ? 'bg-zinc-900 border-white/10 text-white shadow'
                          : 'bg-zinc-950/40 border-white/5 text-zinc-300'
                      }`}>
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                      </div>
                    </div>
                  ))}
                  {isChatSending && (
                    <div className="flex gap-3.5 mr-auto text-left">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <Loader2 className="animate-spin" size={14} />
                      </div>
                      <div className="p-4 rounded-2xl bg-zinc-950/40 border border-white/5 text-xs text-zinc-400">
                        Analyzing S Pen pointer metrics, S Pen Air Actions, and hardware accelerometers context...
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input Tray */}
                <div className="p-4 border-t border-white/10 bg-zinc-950/80">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendChat();
                    }}
                    className="flex gap-3"
                  >
                    <input
                      type="text"
                      className="flex-1 bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-xs placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/35 transition-colors text-white"
                      placeholder="Ask copilot: 'How do S Pen accelerometers affect drawing latency?' or 'Convert a stylus drawing into Android touch coordinate calculations?'"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={isChatSending}
                    />
                    <button
                      type="submit"
                      disabled={isChatSending || !chatInput.trim()}
                      className="bg-purple-600 hover:bg-purple-500 p-3 rounded-xl text-white transition-all disabled:opacity-40 shrink-0"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {/* Tab: Hardware FAQ SDK */}
            {activeTab === 'sdk-advisor' && (
              <motion.div
                key="sdk-advisor-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="h-full p-6 overflow-y-auto space-y-6 text-left"
              >
                <div className="max-w-4xl mx-auto space-y-6 pb-12">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black tracking-wider text-blue-400 uppercase">Hardware Pen & Motion FAQ</h3>
                    <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">In depth insights into Samsung's S Pen Bluetooth controller and accelerometers</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {sPenFaqs.map((faq, index) => (
                      <div 
                        key={index}
                        className="p-6 bg-zinc-950/35 border border-white/5 hover:border-white/10 transition-all rounded-2xl space-y-3.5"
                      >
                        <h4 className="text-xs font-extrabold text-blue-300 uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          {faq.title}
                        </h4>
                        
                        <div className="text-[11.5px] text-zinc-400 leading-relaxed whitespace-pre-line font-medium font-sans">
                          {faq.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
