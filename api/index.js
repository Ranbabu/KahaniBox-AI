import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Google Gemini API URL (Latest Model)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

app.get("/", (req, res) => {
  res.send("KahaniBox AI Server is Running!");
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, history } = req.body;
    
    // Validation
    if (!prompt && !history) return res.status(400).json({ error: "Prompt required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API Key is missing" });

    let fullPrompt;

    // Logic: Clean Prompt Construction
    // अगर हिस्ट्री है, तो उसे साथ में जोड़ें ताकि बात (Context) याद रहे
    if (history) {
        fullPrompt = `Context/History:\n${history.slice(-2000)}\n\nNew Input:\n${prompt}`;
    } 
    else {
        // अगर हिस्ट्री नहीं है, तो सीधा प्रॉम्प्ट भेजें (Bilkul Clean)
        fullPrompt = prompt;
    }

    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error: ${errorText}`);
    }

    const data = await response.json();
    let generated = data.candidates?.[0]?.content?.parts?.[0]?.text || "No content generated.";
    
    // Formatting Cleanup (Bold/Italic markdown hatane ke liye - As per original code)
    generated = generated.replace(/\*\*/g, "").replace(/##/g, "").replace(/\*/g, "").trim();

    res.json({ generated_text: generated });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default app;
