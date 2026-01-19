import express from "express";
import fetch from "node-fetch";

const app = express();

// --- MANUAL CORS SETUP (Bina 'npm install cors' ke chalega) ---
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Sabhi website allow
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  // Pre-flight check handle karein
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// --- GOOGLE MODEL SETUP ---
// 'gemini-1.5-flash' abhi sabse best free model hai jo bina error ke chalta hai.
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

app.get("/", (req, res) => {
  res.send("KahaniBox AI Server is Running! 🚀 (Mode: Manual CORS)");
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, history } = req.body;
    
    // Validation
    if (!prompt && !history) return res.status(400).json({ error: "Prompt is required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("API Key Missing!");
        return res.status(500).json({ error: "Server Error: API Key is missing in Vercel Settings" });
    }

    // Aaj ki taareekh
    const today = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });

    let fullPrompt;
    
    // Check karein user kya mang raha hai
    const isNews = prompt && (prompt.toLowerCase().includes("news") || prompt.toLowerCase().includes("khabar") || prompt.toLowerCase().includes("samachar"));

    if (history) {
        // STORY CONTINUE MODE
        fullPrompt = `Role: Professional Writer.
Task: Continue the story naturally.
Context: "${history.slice(-1000)}"
Instruction: Write next 300-400 words in Hindi. Maintain flow.`;
    } 
    else if (isNews) {
        // NEWS MODE (Verified)
        fullPrompt = `Role: Senior News Anchor (India).
Task: Give Top Verified News Headlines.
Date: ${today} (News MUST be fresh).
Topic: ${prompt}

Rules:
1. Source: Verified channels only (NDTV, AajTak level).
2. Format: "Headline" followed by short detail.
3. Language: Hindi.
4. Formatting: Plain Text (No ** or ##).`;
    } 
    else {
        // FRESH STORY MODE
        fullPrompt = `Role: Best Hindi Storyteller.
Topic: ${prompt}
Task: Write a viral-quality story/script (400 words).
Language: Hindi.
Formatting: Plain Text only (No markdown like **).`;
    }

    // Google API Call
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
    });

    // Error Handling
    if (!response.ok) {
        const errorText = await response.text();
        console.error("Google API Error:", errorText);
        // User ko JSON mein error dikhayen taaki app crash na ho
        return res.status(response.status).json({ error: `AI Model Error: ${errorText}` });
    }

    const data = await response.json();
    let generated = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maafi chahenge, content generate nahi ho paya.";
    
    // Safai
    generated = generated.replace(/\*\*/g, "").replace(/##/g, "").replace(/\*/g, "").trim();

    res.json({ generated_text: generated });

  } catch (err) {
    console.error("Server Crash Error:", err);
    res.status(500).json({ error: "Internal Server Error: " + err.message });
  }
});

export default app;
