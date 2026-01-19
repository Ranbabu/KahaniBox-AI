import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

// 1. CORS Setup (जरूरी है ताकि वेबसाइट से रिक्वेस्ट ब्लॉक न हो)
app.use(cors({
    origin: "*", 
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// SEARCH RESULT: 'gemini-1.5-flash' फ्री टियर में सबसे ज्यादा (High Limit) स्क्रिप्ट देता है।
// '2.5' मॉडल में अक्सर लिमिट कम होती है या वह अभी एक्सपेरिमेंटल है जिससे एरर आता है।
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

app.get("/", (req, res) => {
  res.send("KahaniBox AI Server is Running! 🚀 (Model: 1.5-Flash)");
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, history } = req.body;
    if (!prompt && !history) return res.status(400).json({ error: "Prompt required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API Key is missing" });

    // आज की तारीख (News के लिए)
    const today = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });

    let fullPrompt;
    
    // न्यूज़ डिटेक्शन
    const isNews = prompt && (prompt.toLowerCase().includes("news") || prompt.toLowerCase().includes("khabar") || prompt.toLowerCase().includes("samachar"));

    if (history) {
        // --- HISTORY MODE ---
        fullPrompt = `Role: Professional Story/Script Writer.
Task: Continue the story/script naturally.
Context (Previous 1000 chars): "${history.slice(-1000)}"
Instructions: Maintain the flow. Write the next 300-400 words in Hindi.`;
    } 
    else if (isNews) {
        // --- VERIFIED NEWS MODE ---
        fullPrompt = `Role: Senior Indian News Anchor.
Task: Provide Verified & Authentic news headlines like Top TV Channels (Aaj Tak, NDTV).
Date: ${today} (News MUST be from this date).
Topic: ${prompt}

Strict Rules:
1. **Source:** Only confirmed verified news. No rumors.
2. **Format:** "Headline" followed by 2-3 lines of detail.
3. **Quantity:** If user asks Top 10, give 10. Default: Top 5.
4. **Tone:** Professional, Fast, Energetic TV Style.
5. **Output Language:** Hindi.
6. **No Formatting:** Do NOT use markdown bold/italic (** or *). Just plain text.`;
    } 
    else {
        // --- STORY/SCRIPT MODE ---
        fullPrompt = `Role: Expert Hindi Storyteller & Scriptwriter.
Topic: ${prompt}
Instructions: Write a compelling, high-quality story or YouTube script (400-500 words).
Language: Hindi.
Formatting: Plain text only (No ** or ##).`;
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
    });

    if (!response.ok) {
        // अगर कोई एरर आये तो उसे साफ़-साफ़ दिखाए
        const errorText = await response.text();
        console.error("Gemini API Error:", errorText);
        throw new Error(`Google API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    let generated = data.candidates?.[0]?.content?.parts?.[0]?.text || "कंटेंट जनरेट नहीं हो पाया।";
    
    // सफाई (Markdown हटाना)
    generated = generated.replace(/\*\*/g, "").replace(/##/g, "").replace(/\*/g, "").trim();

    res.json({ generated_text: generated });

  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default app;
