import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Google Gemini API URL (Latest Model as provided)
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
    
    // चेक करें कि क्या यूजर न्यूज़ या जानकारी मांग रहा है (जिसका वीडियो स्क्रिप्ट बनाना है)
    // "news", "khabar", "samachar", "top", "list", "facts" जैसे शब्दों पर स्क्रिप्ट मोड ऑन होगा
    const isScriptRequest = prompt && (
        prompt.toLowerCase().includes("news") || 
        prompt.toLowerCase().includes("khabar") || 
        prompt.toLowerCase().includes("samachar") ||
        prompt.toLowerCase().includes("top") ||
        prompt.toLowerCase().includes("yojana") ||
        prompt.toLowerCase().includes("facts")
    );

    if (history) {
        // --- CHAT / CONTINUATION MODE ---
        fullPrompt = `तुम एक प्रोफेशनल राइटर हो। कहानी/न्यूज़ को आगे बढ़ाओ।
संदर्भ: "${history.slice(-1000)}"
निर्देश: प्रवाह (Flow) टूटने मत देना। अगले 300-400 शब्द लिखो।`;
    } 
    else if (isScriptRequest) {
        // --- VIDEO SCRIPT MODE (UPDATED AS PER USER REQUEST) ---
        fullPrompt = `तुम एक प्रोफेशनल हिंदी वीडियो स्क्रिप्ट राइटर और न्यूज़ एंकर हो।
तुम्हें दिए गए विषय पर एक वीडियो स्क्रिप्ट लिखनी है।
        
आज की तारीख: ${today}
विषय (Topic): ${prompt}

तुम्हें ठीक इसी ढांचे (Structure) का पालन करना है:

1. **Intro**: दर्शकों का स्वागत करो और बताओ कि आज हम किस बारे में बात करेंगे। (जैसे: "नमस्कार दोस्तों! स्वागत है आपका...")
2. **Main Content**: विषय की पूरी जानकारी विस्तार से दो। 
   - अगर "Top 5" या "List" मांगी गई है, तो हर पॉइंट का एक टाइटल (Headline) हो और उसके नीचे 3-4 लाइन की डिटेल हो।
   - भाषा आसान और समझाने वाली (Explainer Style) होनी चाहिए।
3. **Outro**: वीडियो का समापन करो। दर्शकों को Like, Share और Subscribe करने के लिए कहो। जन सेवा केंद्र या वेबसाइट पर जाने की सलाह दो।
4. **Headlines (Summary)**: अंत में, ऊपर बताई गई मुख्य बातों की सिर्फ हेडलाइन्स (Headlines) एक साथ लिखो।

महत्वपूर्ण निर्देश:
- भाषा: हिंदी (Devanagari)।
- टोन: ऊर्जावान (Energetic) और स्पष्ट।
- फॉर्मेटिंग: ** (bold) या ## का उपयोग मत करना, सादा टेक्स्ट लिखो।
- जानकारी "Verified" और आज की तारीख के हिसाब से सटीक होनी चाहिए।`;
    } 
    else {
        // --- STORY MODE ---
        fullPrompt = `तुम एक बेहतरीन हिंदी कहानीकार हो। 
विषय: ${prompt}
निर्देश: 400-500 शब्दों की दिलचस्प कहानी लिखो। कोई ** फॉर्मेटिंग मत यूज़ करो। सीधी और सरल हिंदी लिखो।`;
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
    
    // थोड़ी सफाई (Cleaning formatting symbols as per request)
    generated = generated.replace(/\*\*/g, "").replace(/##/g, "").replace(/\*/g, "").trim();

    res.json({ generated_text: generated });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default app;
