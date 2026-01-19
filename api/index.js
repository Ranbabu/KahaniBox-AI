import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// UPDATE: We switched to 'gemini-1.5-flash' because it has a better Free Tier quota.
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

    const today = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });

    let fullPrompt;
    
    const isScriptRequest = prompt && (
        prompt.toLowerCase().includes("news") || 
        prompt.toLowerCase().includes("khabar") || 
        prompt.toLowerCase().includes("samachar") ||
        prompt.toLowerCase().includes("top") ||
        prompt.toLowerCase().includes("yojana") ||
        prompt.toLowerCase().includes("facts")
    );

    if (history) {
        fullPrompt = `तुम एक प्रोफेशनल राइटर हो। कहानी/न्यूज़ को आगे बढ़ाओ।
संदर्भ: "${history.slice(-1000)}"
निर्देश: प्रवाह (Flow) टूटने मत देना। अगले 300-400 शब्द लिखो।`;
    } 
    else if (isScriptRequest) {
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
        // Error handling behtar kiya gaya hai taki aap console me exact error dekh sakein
        const errorText = await response.text();
        console.error("Gemini API Error Detail:", errorText); 
        throw new Error(`Gemini API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let generated = data.candidates?.[0]?.content?.parts?.[0]?.text || "कंटेंट जनरेट नहीं हो पाया।";
    
    generated = generated.replace(/\*\*/g, "").replace(/##/g, "").replace(/\*/g, "");
    generated = generated.replace(/^\d+[\.\)\-]\s+/gm, "");
    generated = generated.trim();
    generated = generated.replace(/आज तारीख है.*?\|/g, "").replace(/मैं हूँ आपका एंकर.*?\|/g, "");

    res.json({ generated_text: generated });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default app;
