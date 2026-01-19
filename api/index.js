import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// FIXED: Using 'gemini-1.5-flash' which has a high free quota and is stable.
// 'gemini-2.5' ki limit kam thi, isliye error aa raha tha.
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

app.get("/", (req, res) => {
  res.send("KahaniBox AI Server is Running! 🚀");
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, history } = req.body;
    if (!prompt && !history) return res.status(400).json({ error: "Prompt required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API Key is missing" });

    // 1. आज की तारीख (सिर्फ AI को बताने के लिए, स्क्रिप्ट में नहीं बोलेगा)
    const today = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });

    let fullPrompt;
    
    // चेक करें कि क्या यूजर न्यूज़ या वीडियो स्क्रिप्ट मांग रहा है
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
        // --- VIDEO SCRIPT MODE (CLEAN & NO NUMBERS) ---
        fullPrompt = `तुम एक प्रोफेशनल हिंदी वीडियो स्क्रिप्ट राइटर और न्यूज़ एंकर हो।
तुम्हें दिए गए विषय पर एक वीडियो स्क्रिप्ट लिखनी है।
        
संदर्भ के लिए आज की तारीख: ${today} (स्क्रिप्ट में तारीख या समय नहीं बोलना है)।
विषय (Topic): ${prompt}

सख्त निर्देश (Strict Instructions):
1. **Intro**: शुरुआत सीधे "नमस्कार दोस्तों! स्वागत है आपका..." से करो।
2. **No Numbering**: किसी भी खबर या पॉइंट के आगे नंबर (1., 2., 3.) बिल्कुल मत लिखना।
3. **Format**:
   - (Intro)
   - (Main Content - हर खबर की हेडलाइन लिखो और नीचे विस्तार। बिना नंबर के।)
   - (Outro - लाइक, शेयर, सब्सक्राइब अपील)
   - (Headlines - मुख्य हेडलाइन्स की लिस्ट, बिना नंबर के)
4. **Tone**: बातचीत वाली (Conversational), ऊर्जावान और हिंदी (Devanagari) में।
5. **Formatting**: ** (bold), ## (heading) या नंबरिंग (1, 2, 3) का उपयोग बिल्कुल मत करना। टेक्स्ट एकदम साफ़ (Clean) होना चाहिए।

अब स्क्रिप्ट लिखो:`;
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
        // Error ko console mein print karein taki debugging ho sake
        console.error("Gemini API Error Detail:", errorText); 
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    let generated = data.candidates?.[0]?.content?.parts?.[0]?.text || "कंटेंट जनरेट नहीं हो पाया।";
    
    // --- सफाई (Cleaning) ---
    // 1. बोल्ड और हेडिंग सिंबल हटाना
    generated = generated.replace(/\*\*/g, "").replace(/##/g, "").replace(/\*/g, "");
    // 2. लाइन की शुरुआत से नंबर हटाना (जैसे "1. ", "2. ", "1)", "2-")
    generated = generated.replace(/^\d+[\.\)\-]\s+/gm, "");
    // 3. एक्स्ट्रा स्पेस हटाना
    generated = generated.trim();
    // 4. अगर गलती से तारीख या एंकर इंट्रो आ गया हो, तो हटाना
    generated = generated.replace(/आज तारीख है.*?\|/g, "").replace(/मैं हूँ आपका एंकर.*?\|/g, "");

    res.json({ generated_text: generated });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default app;
