import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Google Gemini API URL (Updated to Gemini 2.5 Flash - 2026 Version)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

app.get("/", (req, res) => {
  res.send("KahaniBox AI Server is Running! 🚀");
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, history } = req.body;

    if (!prompt && !history) {
      return res.status(400).json({ error: "Prompt required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API Key is missing in Server Settings" });
    }

    let fullPrompt;
    
    // अगर history है, तो इसका मतलब हम कहानी आगे बढ़ा रहे हैं
    if (history) {
        fullPrompt = `तुम एक बेहतरीन हिंदी कहानीकार हो। 
नीचे दी गई कहानी का अगला भाग (Next Part) लिखो।
पिछली कहानी: "${history.slice(-1000)}" (संदर्भ के लिए)।
निर्देश:
1. कहानी को वहीं से आगे बढ़ाओ जहाँ वह खत्म हुई थी।
2. अगले 500-600 शब्द लिखो।
3. भाषा वही रखो।
4. ** या ## जैसे सिंबल मत यूज़ करना।`;
    } else {
        // नई कहानी
        fullPrompt = `तुम एक बेहतरीन हिंदी कहानीकार हो। 
नीचे दिए गए विषय पर एक विस्तृत हिंदी कहानी का "पहला भाग" (Part 1) लिखो।
विषय: ${prompt}
निर्देश:
1. लगभग 500-600 शब्द लिखो।
2. अभी कहानी खत्म मत करना, इसे एक रोमांचक मोड़ पर छोड़ना ताकि अगला भाग लिखा जा सके।
3. भाषा सरल और आकर्षक हो।
4. ** या ## सिंबल मत यूज़ करना।`;
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }]
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        // अगर 2.5 भी न चले, तो एरर साफ़ दिखेगा
        throw new Error(`Gemini API Error: ${errorText}`);
    }

    const data = await response.json();
    let generated = data.candidates?.[0]?.content?.parts?.[0]?.text || "कहानी जनरेट नहीं हो पाई।";

    // सफाई
    generated = generated.replace(/\*\*/g, "").replace(/##/g, "").replace(/\*/g, "").trim();

    res.json({ generated_text: generated });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default app;
