import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// Google Gemini API URL
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// Google News RSS Feed (Hindi - India)
const GOOGLE_NEWS_RSS = "https://news.google.com/rss?hl=hi&gl=IN&ceid=IN:hi";

app.get("/", (req, res) => {
  res.send("KahaniBox AI News Server Running! 📡");
});

// Helper: XML से डेटा निकालने के लिए (Simple parsing)
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

        // Clean Title (Remove source name from title if present usually after ' - ')
        let cleanTitle = titleMatch ? titleMatch[1] : "No Title";
        const sourceName = sourceMatch ? sourceMatch[1] : "Google News";
        
        // Remove " - Zee News" etc from title for cleaner display
        cleanTitle = cleanTitle.split(" - ")[0];

        items.push({
            title: cleanTitle,
            pubDate: dateMatch ? dateMatch[1] : new Date().toUTCString(),
            source: sourceName
        });
        count++;
    }
    return items;
}

app.post("/api/generate-news", async (req, res) => {
  try {
    const { count, lines } = req.body;
    const limit = parseInt(count) || 5;
    const lineLimit = lines || "3 lines";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API Key is missing" });

    // 1. Fetch Real-time RSS Feed
    const rssResponse = await fetch(GOOGLE_NEWS_RSS);
    const rssText = await rssResponse.text();
    
    // 2. Parse Data
    const newsItems = parseRSS(rssText, limit);

    if (newsItems.length === 0) {
        return res.json({ error: "No news found currently." });
    }

    // 3. Prepare Prompt for Gemini
    const headlinesList = newsItems.map((n, i) => `${i+1}. ${n.title}`).join("\n");
    
    const prompt = `
    Task: You are a professional Hindi News Anchor scriptwriter.
    
    Here are the Top ${limit} real headlines currently in India:
    ${headlinesList}

    Instructions:
    1. Write a news script for EACH headline separately.
    2. The script for each headline must be exactly **${lineLimit} long**.
    3. Language: Hindi (Devanagari).
    4. Tone: Professional, Engaging, TV News Style.
    5. Format:
       Headline 1: [Script]
       
       Headline 2: [Script]
       ...
    6. Do NOT invent new news. Only expand on the provided headlines.
    `;

    // 4. Call Gemini
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await geminiResponse.json();
    let generatedScript = data.candidates?.[0]?.content?.parts?.[0]?.text || "Script generation failed.";

    // Formatting Cleanup
    generatedScript = generatedScript.replace(/\*\*/g, "").replace(/##/g, "").trim();

    // Send back Metadata + Script
    res.json({
        metadata: newsItems, // Array of source, time, title
        script: generatedScript
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Purana endpoint (Story wala) agar chahiye to rakh sakte hain
app.post("/api/generate", async (req, res) => {
    // ... Old logic for stories if needed ...
    // Filhal News focus hai
    res.json({ generated_text: "Use /api/generate-news for news features." });
});

export default app;
