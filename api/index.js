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

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

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
        const sourceName = sourceMatch ? sourceMatch[1] : "Google News";
        let pubDateStr = dateMatch ? dateMatch[1] : new Date().toUTCString();
        
        // Remove source name from the end of title
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

// MAIN API ENDPOINT
app.post("/api/generate-news", async (req, res) => {
  try {
    // Dusri website se aane wala data (topic, count, lines)
    const topic = req.body.topic || "Top News"; 
    const limit = parseInt(req.body.count) || 5;
    const lines = req.body.lines || "5 lines";
    
    let lineInstruction = "Write exactly 2-3 sentences.";
    if(lines.includes("5")) lineInstruction = "Write 5 detailed sentences.";
    if(lines.includes("10")) lineInstruction = "Write a comprehensive 10-sentence paragraph.";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ success: false, error: "API Key Missing from Environment Variables." });
    }

    // 1. Fetch News based on Topic
    const encodedQuery = encodeURIComponent(topic);
    const GOOGLE_NEWS_SEARCH_RSS = `https://news.google.com/rss/search?q=${encodedQuery}&hl=hi&gl=IN&ceid=IN:hi`;

    let newsItems = [];
    try {
        const rssResponse = await fetch(GOOGLE_NEWS_SEARCH_RSS);
        const rssText = await rssResponse.text();
        newsItems = parseRSS(rssText, limit);
    } catch (e) {
        console.error("RSS Fetch Error:", e);
    }

    // 2. Prepare Data for AI
    let headlinesList = "";
    if (newsItems.length > 0) {
        headlinesList = newsItems.map((n, i) => `News ${i+1}: ${n.title}`).join("\n");
    } else {
        // Agar topic se related news nahi milti (jaise koi direct question ho)
        headlinesList = `User Topic/Question: ${topic}\n(Answer this question factually in a news reporter style)`;
        newsItems = [{
            title: `Custom Topic: ${topic}`,
            pubDate: new Date().toUTCString(),
            source: "AI Generated"
        }];
    }
    
    // 3. AI Prompt
    const prompt = `
    Role: Professional Hindi News Anchor Scriptwriter.
    Current Topic / Headlines:
    ${headlinesList}

    INSTRUCTIONS:
    1. Write a script for EACH headline/topic separately.
    2. Length: ${lineInstruction} per news.
    3. Language: Pure Hindi.
    4. CRITICAL FORMATTING:
       - **SEPARATE EACH NEWS SCRIPT WITH THIS EXACT SEPARATOR: "|||"**
       - Start the first news with a Greeting (e.g., Namaskar, Swagat hai).
       - End the last news with a Closing/Thanks.
       - Do NOT use "Headline 1:" or numbers inside the script. 
       - Just the text and the separator.
       - If it's a direct question, answer it like a news reporter explaining a topic.
    `;

    // 4. Call Gemini AI
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await geminiResponse.json();
    let generatedScript = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Cleanup AI Markdown
    generatedScript = generatedScript.replace(/\*\*/g, "").replace(/##/g, "").trim();

    // 5. Send Clean JSON Response
    res.json({
        success: true,
        topic_searched: topic,
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
