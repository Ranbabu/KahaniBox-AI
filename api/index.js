import express from "express";
import fetch from "node-fetch";

const app = express();

// --- 1. MANUAL CORS FIX (Connectivity ke liye) ---
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// --- 2. MODEL: GEMINI 1.5 PRO (High Quality) ---
// Note: 2.0 ki limit khatam thi aur 2.5 exist nahi karta.
// Isliye '1.5-pro' use kiya hai jo 'Flash' se better quality deta hai.
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent";

app.get("/", (req, res) => {
  res.send("KahaniBox AI Server is Running! 🚀 (Model: Gemini 1.5 PRO)");
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, history } = req.body;
    
    if (!prompt && !history) return res.status(400).json({ error: "Prompt is required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "API Key is missing in Settings" });
    }

    // Aaj ki taareekh
    const today = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });

    let fullPrompt;
    
    // Check karein user kya mang raha hai
    const isNews = prompt && (prompt.toLowerCase().includes("news") || prompt.toLowerCase().includes("khabar") || prompt.toLowerCase().includes("samachar"));

    if (history) {
        // STORY CONTINUE
        fullPrompt = `Role: Professional Creative Writer.
Task: Continue the story with high quality vocabulary.
Context: "${history.slice(-1000)}"
Instruction: Write next 300-400 words in Hindi. Maintain a strong narrative flow.`;
    } 
    else if (isNews) {
        // NEWS MODE (Pro Quality)
        fullPrompt = `Role: Senior News Anchor (India).
Task: Give Top Verified News Headlines with professional analysis.
Date: ${today} (News MUST be fresh).
Topic: ${prompt}

Rules:
1. Source: Verified channels only.
2. Format: "Headline" followed by detailed summary.
3. Language: Hindi.
4. Formatting: Plain Text (No ** or ##).`;
    } 
    else {
        // STORY MODE (Pro Quality)
        fullPrompt = `Role: Best Hindi Storyteller.
Topic: ${prompt}
Task: Write a deep, engaging, and high-quality story/script (400-500 words).
Language: Hindi.
Formatting: Plain Text only (No markdown like **).`;
    }

    // Google API Call
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API Error:", errorText);
        
        // Agar 1.5 Pro ki bhi limit hit ho jaye, to error saaf dikhaye
        if (response.status === 429) {
             return res.status(429).json({ error: "Quota Exceeded: Please try again in 1 minute or switch to Flash model." });
        }
        return res.status(response.status).json({ error: `Model Error: ${errorText}` });
    }

    const data = await response.json();
    let generated = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maafi chahenge, content generate nahi ho paya.";
    
    // Safai
    generated = generated.replace(/\*\*/g, "").replace(/##/g, "").replace(/\*/g, "").trim();

    res.json({ generated_text: generated });

  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
});

export default app;
