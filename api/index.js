import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv"; 

dotenv.config();

const app = express();
app.use(express.json());

// Google Gemini API URL (Gemini 2.5 Flash set as requested)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

app.get("/", (req, res) => {
  res.send("KahaniBox AI Server is Running! 🚀");
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, history } = req.body;
    
    // Prompt check
    if (!prompt && !history) return res.status(400).json({ error: "Prompt required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API Key is missing" });

    let fullPrompt;

    // --- LOGIC: Completely Clean ---
    // No hardcoded instructions. Only user input.
    
    if (history) {
        // If history exists, combine it with the new prompt
        fullPrompt = `History:\n${history}\n\nUser Request: ${prompt}`;
    } else {
        // Direct prompt
        fullPrompt = prompt;
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        contents: [{ 
            parts: [{ text: fullPrompt }] 
        }] 
      })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Error: ${errorText}`);
    }

    const data = await response.json();
    
    let generated = data.candidates?.[0]?.content?.parts?.[0]?.text || "No content generated.";
    
    // Simple cleanup
    generated = generated.replace(/\*\*/g, "").replace(/##/g, "").trim();

    res.json({ generated_text: generated });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

export default app;
