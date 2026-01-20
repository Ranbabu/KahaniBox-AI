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
  res.send("KahaniBox AI News Server Running! 🟢");
});

// RSS Parsing Function (Clean Titles)
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
        
        // Remove Source Name from title for display
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
    
    // Dynamic Line Instruction
    let lineInstruction = "Write exactly 2-3 sentences per news.";
    if(lines.includes("2")) lineInstruction = "Write exactly 2 concise sentences per news.";
    if(lines.includes("3")) lineInstruction = "Write exactly 3 sentences per news.";
    if(lines.includes("5")) lineInstruction = "Write 5 detailed sentences per news.";
    if(lines.includes("10")) lineInstruction = "Write a comprehensive 10-sentence paragraph per news.";

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "API Key Missing" });

    // 1. Fetch RSS
    const rssResponse = await fetch(GOOGLE_NEWS_RSS);
    if (!rssResponse.ok) throw new Error("RSS Fetch Failed");
    const rssText = await rssResponse.text();
    
    // 2. Parse
    const newsItems = parseRSS(rssText, limit);
    if (newsItems.length === 0) return res.json({ error: "No news found." });

    // 3. Construct Prompt with Opening/Closing Logic
    const headlinesList = newsItems.map((n, i) => `News ${i+1}: ${n.title}`).join("\n");
    
    const prompt = `
    Role: You are a professional, engaging Hindi TV News Anchor.
    Task: Write a continuous news script for the following headlines.

    Headlines:
    ${headlinesList}

    STRICT RULES FOR SCRIPT GENERATION:
    1. **FIRST NEWS (Opening):** - Start immediately with a warm, professional greeting (e.g., "नमस्कार," "खबरों में आपका स्वागत है," "आज की मुख्य खबरें," etc.). 
       - VARY the greeting every time (Don't always use the same one).
       - Do NOT say "I am [Name]". Just greet the viewer directly.
       - Then cover the first headline.

    2. **MIDDLE NEWS (Transitions):**
       - Use smooth connector words between news items (e.g., "वहीं दूसरी तरफ," "अब रुख करते हैं अगली खबर का," "बढ़ते हैं आगे," etc.).

    3. **LAST NEWS (Closing):**
       - Cover the final headline.
       - AFTER the final headline, add a closing appeal. Ask viewers to 'Subscribe', 'Like', or 'Stay tuned' for updates.
       - End with "धन्यवाद" (Dhanyavad) or "जय हिन्द".

    4. **FORMATTING (CRITICAL):**
       - Language: Pure Hindi (Devanagari).
       - Length: ${lineInstruction}
       - **CLEAN TEXT ONLY:** Do NOT use asterisks (**), hashtags (##), or numbers (1. 2.). 
       - Do NOT write labels like "Headline 1:" or "Anchor:".
       - Just write the spoken script paragraphs separated by a blank line.

    `;

    // 4. Gemini Call
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!geminiResponse.ok) {
        const errText = await geminiResponse.text();
        throw new Error(`Gemini API Error: ${errText}`);
    }

    const data = await geminiResponse.json();
    let generatedScript = data.candidates?.[0]?.content?.parts?.[0]?.text || "Script generation failed.";

    // 5. Backend Cleanup (To ensure 100% clean text)
    generatedScript = generatedScript
        .replace(/\*\*/g, "")       // Remove bold
        .replace(/##/g, "")         // Remove headings
        .replace(/^Headline \d+:/gmi, "") // Remove 'Headline 1:'
        .replace(/^News \d+:/gmi, "")     // Remove 'News 1:'
        .replace(/^\d+\.\s*/gm, "") // Remove '1. ' at start of lines
        .replace(/Anchor:/gi, "")   // Remove 'Anchor:'
        .trim();

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
