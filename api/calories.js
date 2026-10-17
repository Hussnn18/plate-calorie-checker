// api/calories.js
// A Vercel serverless function for the Plate Calorie Checker (index.html).
// It receives a photo of a plate from the page, asks Groq's image model to
// name each food and estimate its calories, and sends a clean list back.

// The image model we use on Groq. If Groq renames or retires it,
// change it here (check console.groq.com/docs/vision).
const MODEL = "qwen/qwen3.8-27b";

// What we ask the model. We want JSON back so the page can build a table and add up totals.
const PROMPT = `You are a nutrition assistant. Look at this photo of a meal.
List every separate food and drink you can see. For each one, estimate the portion size
(use the plate, bowl, cup and cutlery to judge size) and the calories and macros for that portion.
Many meals here are Indian (roti, rice, dal, sabzi, paneer, raita, curd), but name what you actually see.
Include oil, ghee, butter and sugar that is cooked into the food.

Reply with only JSON, no other text, in exactly this shape:
{"is_food": true,
 "items": [{"name": "Dal tadka", "portion": "1 bowl, about 200 g", "calories": 260, "protein_g": 12, "carbs_g": 30, "fat_g": 10}],
 "confidence": "medium",
 "note": "One short sentence about anything that makes the estimate uncertain."}

"confidence" is "low", "medium" or "high".
If there is no food in the photo, reply {"is_food": false, "items": [], "confidence": "high", "note": "Say what the photo shows instead."}`;

export default async function handler(req, res) {
  // Only accept POST requests (the page sends the photo with POST).
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST to send a photo." });
  }

  // The key lives in .env.local (on your laptop) or in Vercel's settings — never in this file or the page.
  // `vercel dev` does not load .env.local by itself, so read it here when running locally.
  if (!process.env.GROQ_API_KEY) {
    try {
      process.loadEnvFile(new URL("../.env.local", import.meta.url));
    } catch {
      // No .env.local file — fall through to the "missing" message below.
    }
  }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY is missing. Add it to .env.local and try again." });
  }

  // The page sends the photo as a "data URL": data:image/jpeg;base64,....
  const { image } = req.body || {};
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return res.status(400).json({ error: "No photo received." });
  }

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
        response_format: { type: "json_object" }, // ask Groq to return valid JSON only
        temperature: 0.2, // low = more consistent estimates
        max_completion_tokens: 2048,
      }),
    });

    const data = await groqResponse.json();

    // Groq sends an error (for example: wrong key, or too many requests).
    if (!groqResponse.ok) {
      const message = data?.error?.message || "Groq returned an error.";
      const hint = groqResponse.status === 429 ? " (Free limit reached — wait a minute and try again.)" : "";
      return res.status(groqResponse.status).json({ error: message + hint });
    }

    const answer = data.choices?.[0]?.message?.content || "";
    const result = readJson(answer);
    if (!result) {
      console.log("Model answer that was not JSON:", answer); // shows in the vercel dev terminal
      return res.status(502).json({ error: "The model's answer was not in the expected format. Press the button to try again." });
    }

    // Tidy the answer so the page can trust every field.
    const items = (Array.isArray(result.items) ? result.items : []).map((item) => ({
      name: String(item?.name || "Unknown food"),
      portion: String(item?.portion || ""),
      calories: wholeNumber(item?.calories),
      protein_g: wholeNumber(item?.protein_g),
      carbs_g: wholeNumber(item?.carbs_g),
      fat_g: wholeNumber(item?.fat_g),
    }));

    return res.status(200).json({
      is_food: result.is_food !== false && items.length > 0,
      items,
      confidence: ["low", "medium", "high"].includes(result.confidence) ? result.confidence : "low",
      note: String(result.note || ""),
    });
  } catch (err) {
    return res.status(500).json({ error: "Could not reach Groq: " + err.message });
  }
}

// Pull the JSON object out of the model's answer.
// Some models "think out loud" inside <think>…</think> or wrap JSON in ``` fences, so skip those parts.
function readJson(text) {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Turn "250", 250.4 or "about 250" into 250. Anything unusable becomes 0.
function wholeNumber(value) {
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}
