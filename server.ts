import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("WARNING: GEMINI_API_KEY is not defined. AI functions will run in simulated mode.");
}

// 1. AI Home Advisor API Endpoint
app.post("/api/advisor", async (req, res) => {
  const { query, budget, state, zipCode, landStatus, preferredType, previousMessages = [] } = req.body;

  if (!ai) {
    // Simulated fallback if API key is missing
    return res.json({
      text: `[SIMULATED ADVISOR] (API Key missing)
Based on your budget of $${budget || "any"} and preference for a ${preferredType || "prefab home"} in ${state || "US"} (ZIP: ${zipCode || "N/A"}), here is some guidance:
1. **Zoning & Permits**: Since you ${landStatus === "owned" ? "own land" : "do not own land yet"}, please verify local zoning regulations for ADUs or primary dwellings in your municipality. Texas and Florida have more permissive modular codes, while California has strict Title 24 energy compliance.
2. **Landed Cost Estimate**: A factory cost of $50,000 typically incurs $15,000 in ocean freight/duties and $10,000+ for local foundation and crane setup.
3. **Recommended Next Step**: Connect with verified manufacturers to request custom floor plans.

*Disclaimer: This is an AI advice summary. This platform is not a licensed builder or contractor. Verify all zoning, codes, and permits locally before making purchase commitments.*`,
    });
  }

  try {
    const formattedHistory = previousMessages.map((msg: any) => ({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    const contents = [
      ...formattedHistory,
      {
        role: "user",
        parts: [{
          text: `Buyer Inquiry Details:
- User Question/Query: "${query}"
- Estimated Budget: $${budget || "Not specified"}
- Target Location: State ${state || "Not specified"}, ZIP code ${zipCode || "Not specified"}
- Land Ownership: ${landStatus === "owned" ? "Owns land" : "Searching for land / rented"}
- Preferred House Type: ${preferredType || "Any / Prefab"}

Provide highly specific advice regarding:
1. Product categories matching their budget and requirements.
2. Estimated shipping & inland trucking considerations for ${state || "the United States"} (nearest ports).
3. Local zoning, ADU compliance, foundation types, and permitting recommendations.
4. Detailed next steps (contacting manufacturers, site preparation, crane hiring).
5. ALWAYS append a clear, friendly legal disclaimer at the very end stating that the buyer must verify local zoning, engineering, and building codes with county officials, and that the platform is not a licensed contractor.`
        }],
      }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: "You are 'PrefabHome AI Advisor', an expert consultant in cross-border modular home logistics, U.S. building codes (IBC/IRC, HUD, ADU laws, CA Title 24), and factory procurement in China. Provide detailed, helpful, structured, and realistic advice in English or Chinese based on user's query language. Be highly technical yet clear. Never state that you are just a language model.",
        temperature: 0.7,
      },
    });

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini Advisor Error:", error);
    res.status(500).json({ error: "Failed to generate advice from Gemini", details: error.message });
  }
});

// 2. Real-Time Translation API Endpoint
app.post("/api/translate", async (req, res) => {
  const { text, targetLang } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Missing 'text' parameter for translation." });
  }

  if (!ai) {
    // Simulated fallback
    const isToChinese = targetLang === "zh";
    return res.json({
      translatedText: isToChinese 
        ? `[译] ${text} (翻译服务未连接API Key)`
        : `[Translation] ${text} (Translation service offline)`,
    });
  }

  try {
    const prompt = `Translate the following text into ${targetLang === "zh" ? "Simplified Chinese" : "American English"}. Provide ONLY the final translation, without any introduction, quotes, explanation, or notes.
Text to translate:
"""
${text}
"""`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
      },
    });

    res.json({ translatedText: response.text?.trim() });
  } catch (error: any) {
    console.error("Gemini Translation Error:", error);
    res.status(500).json({ error: "Failed to translate", details: error.message });
  }
});

// Serve static assets and handle routing
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer();
