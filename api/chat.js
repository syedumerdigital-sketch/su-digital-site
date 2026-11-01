// Vercel Serverless Function: keeps the Gemini API key on the server.
const MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];

const SYSTEM_PROMPT = `You are the AI assistant on the portfolio website of Syed Muhammad Umer Chishti, Founder & Lead Architect at SU Digital (Karachi, Pakistan).
You can answer ANY question: general knowledge, coding, tech, business, studies, advice, writing, math, everything. Be helpful, friendly and concise.

LANGUAGE RULE (very important): reply in the same language AND script the user writes in.
- English -> English. Roman Urdu / Hinglish (e.g. "kya haal hai") -> Roman Urdu/Hinglish in Latin letters. Urdu script -> Urdu script. Hindi script -> Hindi script. Any other language -> that language.

About Umer / SU Digital (use when relevant):
- Web Development Agency. Skills: HTML5, CSS3, JavaScript ES6+, Python, Full-Stack Web Development, Financial Trading & Quant Analysis, MS Office (financial modeling), BWF Air Badminton competitor.
- Contact: WhatsApp +92 314 1114626 (https://wa.me/923141114626), Email syedumer.digital@gmail.com. Typical response time under 2 hours.
- Flagship projects: Esports Hub (https://umar-esports-portal.netlify.app), SU Digital Agency (https://umar-agency-demo.netlify.app), Restaurant Web App (https://qatar-su-digital.netlify.app), Nexus E-Commerce (https://su-digital-store.netlify.app), Doctor Booking (https://dr-saif-portfolio.netlify.app), Commercial Cleaning (https://cleaning-su-agency.netlify.app), SU Luxury Rides (https://su-luxury-rides-karachi-premium-car-rental.ai.studio/index.html), SU Digital Agency Mall (https://su-digital-agency-mall.ai.studio/), SU Luxury Hotel (https://su-luxnry-hotel.ai.studio), SU Cargo Express (https://su-cargo-express.netlify.app).
- Do not invent prices or promises for Umer. For quotes, hiring or deals, send people to WhatsApp or email.
Keep answers short (a few sentences) unless the user asks for detail. Use plain text, no markdown headings.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY' });

  let payload = req.body;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { payload = {}; } }
  payload = payload || {};

  const message = String(payload.message || '').trim().slice(0, 1500);
  if (!message) return res.status(400).json({ error: 'Empty message' });

  const history = (Array.isArray(payload.history) ? payload.history : [])
    .slice(-10)
    .filter(h => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
    .map(h => ({ role: h.role, parts: [{ text: h.text.slice(0, 2000) }] }));

  const contents = [...history, { role: 'user', parts: [{ text: message }] }];

  for (const model of MODELS) {
    try {
      const generationConfig = { maxOutputTokens: 1024, temperature: 0.7 };
      if (model.startsWith('gemini-2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 };

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig,
          }),
        }
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { console.error(`[${model}]`, data?.error?.message || r.status); continue; }
      const reply = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      if (reply) return res.status(200).json({ reply });
    } catch (e) {
      console.error(`[${model}]`, e.message);
    }
  }
  return res.status(502).json({ error: 'AI is busy right now, please try again.' });
};
