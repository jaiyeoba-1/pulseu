// Try a stable model first, fall back to others if one is overloaded.
const MODELS = ["gemini-flash-latest"];

const SCHEMA={type:"OBJECT",properties:{
  summary:{type:"STRING"},
  complete_tonight:{type:"ARRAY",items:{type:"OBJECT",properties:{task:{type:"STRING"},duration_minutes:{type:"INTEGER"},why:{type:"STRING"}},required:["task","duration_minutes","why"]}},
  reschedule:{type:"ARRAY",items:{type:"OBJECT",properties:{task:{type:"STRING"},why:{type:"STRING"}},required:["task","why"]}},
  tomorrow_plan:{type:"ARRAY",items:{type:"OBJECT",properties:{task:{type:"STRING"},suggested_time:{type:"STRING"},duration_minutes:{type:"INTEGER"}},required:["task","suggested_time","duration_minutes"]}},
  stop_time:{type:"STRING"},
  recovery_actions:{type:"ARRAY",items:{type:"STRING"}}},
  required:["summary","complete_tonight","reschedule","tomorrow_plan","stop_time","recovery_actions"]};

const RULES=`You are PulseU, a capacity coach for a college student.
HARD RULES:
- strain_score came from a deterministic formula, 0-100, where HIGHER means MORE depleted. You EXPLAIN it. Never recalculate or invent a different number.
- No clinical or diagnostic language. Say "capacity", never "burnout diagnosis".
- Only reference tasks the student actually listed. Never invent assignments.
- Concrete and brief. No pep talk, no platitudes, no "practice self-care".
- Low capacity means protect their evening: fewer tasks tonight, more pushed to tomorrow.`;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function generateRecoveryPlan(context: unknown) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing");

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: RULES }] },
    contents: [{ parts: [{ text: "Student's day as structured data. Build their evening and tomorrow.\n\n" + JSON.stringify(context, null, 2) }] }],
    generationConfig: { temperature: 0.4, responseMimeType: "application/json", responseSchema: SCHEMA },
  });

  let lastError = "";

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { method: "POST", headers: { "Content-Type": "application/json", "X-goog-api-key": key }, body }
      );

      if (res.ok) {
        const d = await res.json();
        const t = d?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (t) {
          console.log(`[gemini] ok via ${model}`);
          return JSON.parse(t);
        }
        lastError = "no text in response";
        break;
      }

      lastError = `${model} ${res.status}: ${(await res.text()).slice(0, 200)}`;

      // 503 = overloaded, 429 = rate limited. Both are worth waiting out.
      if (res.status === 503) {
        console.log(`[gemini] ${model} busy, retry ${attempt + 1}/3`);
        await sleep(1000 * Math.pow(2, attempt));
        continue;
      }
      break; // any other error: this model won't work, try the next one
    }
  }

  throw new Error(`All Gemini models failed. Last: ${lastError}`);
}