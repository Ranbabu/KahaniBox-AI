import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

// CORS allow karta hai taaki aap is API ko kisi bhi dusri website se call kar sakein
app.use(cors({
    origin: "*", 
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// Stable Gemini Model use kiya gaya hai
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

// Simple Health Check
app.get("/", (req, res) => {
  res.json({ status: "API is Running 🟢", message: "Send POST request to /api/generate-news" });
});

// RSS Parser
function parseRSS(xmlText, limit) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title>([\s\S]*?)<\/title>/;
    const dateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/;
    const sourceRegex = /<source url=".*?">([\s\S]*?)<\/source>/;

    let match;
    let count = 0;
    
    while ((match = itemRegex.exec(xmlText)) !== null && count < limit) {
        const itemContent = match[1];
        
        const titleMatch = titleRegex.exec(itemContent);
        const dateMatch = dateRegex.exec(itemContent);
        const sourceMatch = sourceRegex.exec(itemContent);

        let cleanTitle = titleMatch ? titleMatch[1] : "No Title";
        const sourceName = sourceMatch ? sourceMatch[1] : "News Source";
        let pubDateStr = dateMatch ? dateMatch[1] : new Date().toUTCString();
        
        // Remove source name from the end of title
        cleanTitle = cleanTitle.split(" - ")[0].trim();

        items.push({
            title: cleanTitle,
            pubDate: pubDateStr,
            source: sourceName
        });
        count++;
    }
    return items;
}

// MAIN API ENDPOINT
app.post("/api/generate-news", async (req, res) => {
  try {
    // 1. Frontend se data receive karna
    const category = req.body.category || "general"; 
    const limit = parseInt(req.body.count) || 5;
    const lines = req.body.lines || "5 lines";
    
    // 2. Category ko Google News Search Query mein convert karna
    let searchQuery = "भारत की ताज़ा खबरें"; // Default
    if (category === "govt_rules") {
        searchQuery = "भारत सरकार नए नियम लागू";
    } else if (category === "govt_schemes") {
        searchQuery = "भारत सरकार नई योजनाएं";
    } else if (category === "govt_regulations") {
        searchQuery = "भारत सरकार बड़े फैसले";
    } else if (category === "general") {
        searchQuery = "भारत देश-दुनिया की बड़ी खबरें";
    }

    // 3. Script Length ki instruction
    let lineInstruction = "Write exactly 2 to 3 sentences per news.";
    if(lines.includes("5")) lineInstruction = "Write exactly 5 detailed sentences per news.";
    if(lines.includes("10")) lineInstruction = "Write a comprehensive 10-sentence deep analysis per news.";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ success: false, error: "API Key Missing from Environment Variables." });
    }

    // 4. Fetch News based on Search Query
    const encodedQuery = encodeURIComponent(searchQuery);
    const GOOGLE_NEWS_SEARCH_RSS = `https://news.google.com/rss/search?q=${encodedQuery}&hl=hi&gl=IN&ceid=IN:hi`;

    let newsItems = [];
    try {
        const rssResponse = await fetch(GOOGLE_NEWS_SEARCH_RSS);
        const rssText = await rssResponse.text();
        newsItems = parseRSS(rssText, limit);
    } catch (e) {
        console.error("RSS Fetch Error:", e);
    }

    // 5. Prepare Data for AI
    let headlinesList = "";
    if (newsItems.length > 0) {
        headlinesList = newsItems.map((n, i) => `Headline ${i+1}: ${n.title}`).join("\n");
    } else {
        headlinesList = `Topic: ${searchQuery}`;
        newsItems = [{ title: `Top news about ${searchQuery}`, pubDate: new Date().toUTCString(), source: "AI Search" }];
    }
    
    // 6. STRICT AI Prompt (Krantikari Tone, Pure Hindi, TTS Ready)
    const prompt = `
    Role: Professional Hindi News Anchor Scriptwriter.
    Tone: Urgent, energetic, authoritative, and revolutionary (क्रांतिकारी और असरदार ब्रेकिंग न्यूज़ स्टाइल).
    Language: Pure Professional Hindi (No Hinglish).

    Current Headlines:
    ${headlinesList}

    STRICT INSTRUCTIONS:
    1. Write the script for EACH headline separately.
    2. Length: ${lineInstruction}
    3. CRITICAL SEPARATOR: You MUST separate each news script with exactly "|||". (Example: Script 1 ||| Script 2 ||| Script 3). Do NOT put "|||" at the very end of the text.
    4. NO FILLERS: Do NOT include any greetings (like Namaskar, Swagat hai), anchor names, or closing remarks. Start directly with the news content.
    5. NO LABELS: Do NOT write "News 1:", "Headline:", or bullet points in the output. Just provide the raw conversational text ready for a TTS engine.
    `;

    // 7. Call Gemini AI
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
              temperature: 0.7, // Thoda dynamic aur energetic banane ke liye
          }
      })
    });

    const data = await geminiResponse.json();
    let generatedScript = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Cleanup AI Markdown and unwanted spaces
    generatedScript = generatedScript.replace(/\*\*/g, "").replace(/##/g, "").trim();

    // 8. Send Clean JSON Response to Frontend
    res.json({
        success: true,
        topic_searched: searchQuery,
        script: generatedScript,
        metadata: newsItems
    });

  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// For local testing (Vercel uses export default app)
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`API running locally on port ${PORT}`));
}

export default app;
