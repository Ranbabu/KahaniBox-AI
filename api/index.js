import express from "express";
import fetch from "node-fetch";

const app = express();

// --- 1. MANUAL CORS SETUP (Network Error Fix) ---
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json());

// --- MODELS LIST ---
const MODEL_PRIMARY = "gemini-2.0-flash-exp"; // आपकी पहली पसंद
const MODEL_BACKUP = "gemini-1.5-flash";      // बैकअप (ताकि एरर न आये)

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

app.get("/", (req, res) => {
  res.send("KahaniBox AI Server is Running! 🚀 (Auto-Switch Mode)");
});

// --- HELPER FUNCTION: CALL GOOGLE API ---
async function generateContent(modelName, apiKey, prompt) {
    const url = `${BASE_URL}${modelName}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    return response;
}

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, history } = req.body;
    if (!prompt && !history) return res.status(400).json({ error: "Prompt is required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API Key is missing" });

    const today = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });

    // --- PROMPT CREATION ---
    let fullPrompt;
    const isNews = prompt && (prompt.toLowerCase().includes("news") || prompt.toLowerCase().includes("khabar") || prompt.toLowerCase().includes("samachar"));

    if (history) {
        fullPrompt = `Role: Story Writer. Context: "${history.slice(-1000)}". Task: Write next 300 words in Hindi. Maintain flow.`;
    } else if (isNews) {
        fullPrompt = `Role: News Anchor. Date: ${today}. Task: Top Verified News Headlines in Hindi. Format: Headline followed by details.`;
    } else {
        fullPrompt = `Role: Storyteller. Topic: ${prompt}. Task: Write a 400-word story in Hindi. No markdown (**).`;
    }

    // --- ATTEMPT 1: TRY GEMINI 2.0 FLASH ---
    console.log("Attempting with Gemini 2.0...");
    let response = await generateContent(MODEL_PRIMARY, apiKey, fullPrompt);

    // Agar 2.0 fail hua (Quota/Limit Error 429), to 1.5 try karein
    if (response.status === 429 || response.status === 503) {
        console.warn("⚠️ Gemini 2.0 Quota Full! Switching to Backup (1.5 Flash)...");
        response = await generateContent(MODEL_BACKUP, apiKey, fullPrompt);
    }

    if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: `AI Error: ${errorText}` });
    }

    const data = await response.json();
    let generated = data.candidates?.[0]?.content?.parts?.[0]?.text || "Content generation failed.";
    
    // Safai
    generated = generated.replace(/\*\*/g, "").replace(/##/g, "").replace(/\*/g, "").trim();

    // Response bhejein (Saath mein bataayein kaunsa model use hua)
    res.json({ generated_text: generated });

  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ error: "Server Error: " + err.message });
  }
});

export default app;
