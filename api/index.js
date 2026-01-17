import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Google Gemini API URL (Latest Model)
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

app.get("/", (req, res) => {
  res.send("KahaniBox AI Server is Running! 🚀");
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, history } = req.body;
    if (!prompt && !history) return res.status(400).json({ error: "Prompt required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API Key is missing" });

    // 1. आज की तारीख और समय (ताकि खबर बासी न हो)
    const today = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });

    let fullPrompt;
    
    // चेक करें कि क्या यूजर न्यूज़ मांग रहा है
    const isNews = prompt && (prompt.toLowerCase().includes("news") || prompt.toLowerCase().includes("khabar") || prompt.toLowerCase().includes("samachar"));

    if (history) {
        fullPrompt = `तुम एक प्रोफेशनल राइटर हो। कहानी/न्यूज़ को आगे बढ़ाओ।
संदर्भ: "${history.slice(-1000)}"
निर्देश: प्रवाह (Flow) टूटने मत देना। अगले 300-400 शब्द लिखो।`;
    } 
    else if (isNews) {
        // --- VERIFIED NEWS MODE ---
        fullPrompt = `तुम भारत के एक वरिष्ठ (Senior) न्यूज़ एंकर हो।
तुम्हें सिर्फ भरोसेमंद चैनल्स (जैसे: Aaj Tak, NDTV, ETV Bharat, India TV, Zee News) के स्तर की "Verified" और "Authentic" खबरें देनी हैं।

आज की तारीख और समय: ${today} (महत्वपूर्ण: खबरें इसी तारीख की होनी चाहिए)।

विषय: ${prompt}

सख्त निर्देश (Strict Instructions):
1. **Source:** खबरें ऐसी हों जो सत्यापित (Verified) हों। अफवाहें बिल्कुल न लिखें।
2. **Format:** हर खबर की शुरुआत "Headline" से हो, फिर 2-3 लाइन का विस्तार।
3. **Count:** अगर यूजर ने Top 10, Top 25 कहा है, तो उतनी ही खबरें दो। अगर नहीं कहा, तो Top 5 सबसे बड़ी खबरें दो।
4. **Tone:** भाषा गंभीर, तेज और ऊर्जावान (TV News Style) होनी चाहिए।
5. **Structure:** - शुरुआत: "नमस्कार, आज ${today} की मुख्य हेडलाइन्स में आपका स्वागत है..."
   - मध्य: एक के बाद एक खबरें (बिना ** सिंबल के)।
   - अंत: "देखते रहिए verified खबरें, धन्यवाद।"`;
    } 
    else {
        // STORY MODE
        fullPrompt = `तुम एक बेहतरीन हिंदी कहानीकार हो। 
विषय: ${prompt}
निर्देश: 400-500 शब्दों की दिलचस्प कहानी लिखो। कोई ** फॉर्मेटिंग मत यूज़ करो।`;
    }

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
    let generated = data.candidates?.[0]?.content?.parts?.[0]?.text || "कंटेंट जनरेट नहीं हो पाया।";
    
    // थोड़ी सफाई
    generated = generated.replace(/\*\*/g, "").replace(/##/g, "").replace(/\*/g, "").trim();

    res.json({ generated_text: generated });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default app;
