import express from "express";
import fetch from "node-fetch";

const app = express();

// --- 1. MANUAL CORS (बिना Install किए चलेगा) ---
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json());

// --- 2. MODEL SETTINGS ---
// आपकी रिक्वेस्ट पर Primary Model '2.5' रखा है।
const MODEL_PRIMARY = "gemini-2.5-flash"; 
const MODEL_BACKUP = "gemini-1.5-flash"; // बैकअप (ताकि एरर न आए)

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

// Helper Function: API Call करने के लिए
async function generateContent(modelName, apiKey, prompt) {
    const response = await fetch(`${BASE_URL}${modelName}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    return response;
}

app.get("/", (req, res) => {
  res.send("KahaniBox AI Server is Running! 🚀");
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, history } = req.body;
    if (!prompt && !history) return res.status(400).json({ error: "Prompt required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API Key is missing" });

    const today = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });

    // --- PROMPT READY ---
    let fullPrompt;
    const isNews = prompt && (prompt.toLowerCase().includes("news") || prompt.toLowerCase().includes("khabar") || prompt.toLowerCase().includes("samachar"));

    if (history) {
        fullPrompt = `Role: Professional Writer. Context: "${history.slice(-1000)}". Task: Write next 300 words in Hindi. Maintain flow.`;
    } else if (isNews) {
        fullPrompt = `Role: Senior News Anchor. Date: ${today}. Task: Top Verified News Headlines in Hindi. Format: Headline followed by details.`;
    } else {
        fullPrompt = `Role: Storyteller. Topic: ${prompt}. Task: Write a 400-word story in Hindi. No markdown (**).`;
    }

    // --- 3. EXECUTION LOGIC ---
    
    // Step 1: Gemini 2.5 Try करें (आपकी पसंद)
    console.log(`Attempting with ${MODEL_PRIMARY}...`);
    let response = await generateContent(MODEL_PRIMARY, apiKey, fullPrompt);

    // Step 2: अगर 2.5 काम नहीं करता (404 Not Found या 400 Bad Request), तो बैकअप चलाएं
    if (!response.ok) {
        console.warn(`⚠️ ${MODEL_PRIMARY} failed (Status: ${response.status}). Switching to backup...`);
        // 1.5 Flash से कोशिश करें
        response = await generateContent(MODEL_BACKUP, apiKey, fullPrompt);
    }

    // Step 3: अगर दोनों फेल हो जाएं
    if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: `AI Error: ${errorText}` });
    }

    const data = await response.json();
    let generated = data.candidates?.[0]?.content?.parts?.[0]?.text || "Content generate nahi ho paya.";
    
    // Cleaning
    generated = generated.replace(/\*\*/g, "").replace(/##/g, "").replace(/\*/g, "").trim();

    res.json({ generated_text: generated });

  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
});

export default app;
