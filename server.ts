import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Gemini Initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper to run generating content with exponential backoff on 503 or high demand transient errors,
// and automatic fallback to alternative stable models if the preferred model is overloaded.
async function generateContentWithRetry(aiClient: GoogleGenAI, params: any, retries = 2, initialDelay = 1200) {
  let delay = initialDelay;
  
  // Create a priority queue of models to try
  const originalModel = params.model || "gemini-3.5-flash";
  const defaultFallbacks = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  
  // Generate the sequence of models to try. We start with the requested one, then try the others.
  const modelsToTry = [originalModel];
  for (const m of defaultFallbacks) {
    if (!modelsToTry.includes(m)) {
      modelsToTry.push(m);
    }
  }

  let lastError: any = null;

  for (const model of modelsToTry) {
    const currentParams = { ...params, model };
    delay = initialDelay; // Reset delay for the new model

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        console.log(`[Gemini API] Requesting model "${model}" (attempt ${attempt}/${retries + 1})`);
        return await aiClient.models.generateContent(currentParams);
      } catch (error: any) {
        lastError = error;
        const errMsg = error?.message || "";
        const isTransient = 
          error?.status === 503 ||
          error?.statusCode === 503 ||
          errMsg.includes("503") ||
          errMsg.includes("UNAVAILABLE") ||
          errMsg.includes("high demand") ||
          errMsg.includes("temporary") ||
          errMsg.includes("Resource has been exhausted") ||
          errMsg.includes("quota");

        if (isTransient) {
          if (attempt <= retries) {
            console.warn(`[Gemini API] Call to "${model}" failed with transient error/quota. Retrying in ${delay}ms... Details:`, errMsg);
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff increment
          } else {
            console.warn(`[Gemini API] All retries for model "${model}" exhausted. Trying next fallback model...`);
            break; // Break the inner retry loop to try the next fallback model
          }
        } else {
          // Non-transient errors (e.g. invalid arguments) are thrown immediately
          throw error;
        }
      }
    }
  }

  // If loops finished without returning, throw the last captured error
  throw lastError || new Error("Failed to generate content with all available models.");
}

// API Routes
app.post("/api/gemini/inspire", async (req, res) => {
  try {
    const { imageData, prompt } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: "Image data is required" });
    }

    // Prepare content for Gemini
    // Remove data:image/png;base64, prefix
    const base64Data = imageData.split(',')[1];
    
    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Data,
            }
          },
          {
            text: prompt || "Analyze this drawing and provide 3 creative suggestions for how to advance or remix it. Be inspiring and concise."
          }
        ]
      }
    });

    res.json({ text: response?.text || "No response received" });
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ 
      error: error?.message || "Internal server error during Gemini analysis. Please try again." 
    });
  }
});

app.post("/api/gemini/android-developer", async (req, res) => {
  try {
    const { mode, language, prompt, imageData, layersSummary } = req.body;

    let parts: any[] = [];

    // Attach dataUrl/image binary if present for vision support
    if (imageData && imageData.includes(",")) {
      const base64Data = imageData.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: base64Data,
        }
      });
    }

    if (mode === 'code-gen') {
      const configPrompt = `You are a specialist in S Pen SDK and Android Framework canvas development.
Convert the user's sketch drawing on canvas into a highly-performant, beautiful native Android S Pen implementation in Kotlin.
Generate code for: ${language === 'compose' ? 'Jetpack Compose Canvas (using PointerInput with pressure sensitivity, stylus/eraser pointer differentiation)' : 'Android SDK Custom View (extending View class, override onTouchEvent, capture getPressure, getToolType, handle paint paths)'}.

Here is the current canvas drawing structures & parameters summary:
${layersSummary || 'No shapes drawn yet.'}

Make sure to implement:
- Drawing paths smoothly (e.g. QuadBezier or standard Path segments).
- Pressure-sensitive brush stroke thickness matching the pressure readings!
- Distinct pointer handlers: differentiating normal finger/mouse touch and specialized S Pen stylus pen clicks and back-end physical tool erasing.
- S Pen button trigger shortcuts or double tap actions.

Format the output strictly as high-quality, professional, copyable, compile-ready Kotlin source code. Begin directly with the code block.`;
      
      parts.push({ text: configPrompt });

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: { parts }
      });
      
      return res.json({ text: response?.text || "// Code generation completed without text output." });
    } else {
      // Chat mode
      const chatPrompt = `You are an expert Copilot for Android Custom Views, S Pen SDK and stylus-hardware tracking (polling rate, tactile latency, variable refresh rates, BLE Air Actions).
The user is asking a developer question. Provide a helpful, technical, yet friendly guide with clean code examples where appropriate.

User Question: "${prompt || 'Explain how pointer pressure is calculated in Android custom canvases.'}"

Current canvas reference drawings description:
${layersSummary || 'No shapes or layers drawn yet.'}

Frame the answers elegantly. Answer directly to the user's inquiry, covering hardware status checks, S Pen BLE motion accelerometers, power/temperature governors, and screen refresh rate overrides if relevant.`;

      parts.push({ text: chatPrompt });

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: { parts }
      });

      return res.json({ text: response?.text || "I was unable to formulate an answer now. Please try again soon." });
    }
  } catch (error: any) {
    console.error("Android Dev Hub Gemini Error:", error);
    res.status(500).json({
      error: error?.message || "Internal server error during Android Dev synthesis."
    });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
