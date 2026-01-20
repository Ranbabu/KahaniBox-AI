import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors({
    origin: "*", 
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const GOOGLE_NEWS_RSS = "https://news.google.com/rss?hl=hi&gl=IN&ceid=IN:hi";

app.get("/", (req, res) => {
  res.send("News Studio AI Backend Running! 🟢");
});

// Improved RSS Parser
function parseRSS(xmlText, limit) {
    const items = [];
    // Regex to find items
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
        const sourceName = sourceMatch ? sourceMatch[1] : "Google News";
        
        // Date Fix: If date is missing or invalid, use Current Time
        let pubDateStr = dateMatch ? dateMatch[1] : new Date().toUTCString();
        
        // Remove Source Name from Title
        cleanTitle = cleanTitle.split(" - ")[0];

        items.push({
            title: cleanTitle,
            pubDate: pubDateStr,
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
    
    let lineInstruction = "Write exactly 2-3 sentences.";
    if(lines.includes("5")) lineInstruction = "Write 5 detailed sentences.";
    if(lines.includes("10")) lineInstruction = "Write a comprehensive 10-sentence paragraph.";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API Key Missing" });

    // 1. Fetch RSS
    const rssResponse = await fetch(GOOGLE_NEWS_RSS);
    const rssText = await rssResponse.text();
    const newsItems = parseRSS(rssText, limit);

    if (newsItems.length === 0) return res.json({ error: "No news found." });

    // 2. Prompt Construction
    const headlinesList = newsItems.map((n, i) => `News ${i+1}: ${n.title}`).join("\n");
    
    const prompt = `
    Role: Professional Hindi News Anchor Scriptwriter.
    Headlines:
    ${headlinesList}

    INSTRUCTIONS:
    1. Write a script for EACH headline separately.
    2. Length: ${lineInstruction} per news.
    3. Language: Pure Hindi.
    4. CRITICAL FORMATTING:
       - **SEPARATE EACH NEWS SCRIPT WITH THIS EXACT SEPARATOR: "|||"**
       - Start the first news with a Greeting.
       - End the last news with a Closing/Thanks.
       - Do NOT use "Headline 1:" or numbers inside the script. 
       - Just the text and the separator.
    
    Example Output:
    Namaskar... text... ||| Agli khabar... text... ||| Teesari khabar... text...
    `;

    // 3. Call Gemini
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await geminiResponse.json();
    let generatedScript = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Cleanup
    generatedScript = generatedScript.replace(/\*\*/g, "").replace(/##/g, "").trim();

    res.json({
        metadata: newsItems,
        script: generatedScript
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default app;
