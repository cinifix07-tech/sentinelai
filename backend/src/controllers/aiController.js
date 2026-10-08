const OPENAI_URL = 'https://api.openai.com/v1/responses';
async function chat(req, res, next) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'OpenAI is not configured. Add OPENAI_API_KEY to backend/.env.' });

    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'A message is required.' });
    if (message.length > 4000) return res.status(400).json({ error: 'Message must be 4000 characters or fewer.' });

    const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini',
        store: false,
        input: [
          {
            role: 'system',
            content: [{
              type: 'input_text',
              text: 'You are Sentinel AI, a concise admin access-control assistant for a home-security system. Help authorized administrators review security state, access requests, device status, and safe next steps. Never claim that a door is unlocked or that an access decision is authorized unless the application explicitly reports that state. Never impersonate a visitor. Keep replies under 120 words.',
            }],
          },
          {
            role: 'user',
            content: [{
              type: 'input_text',
              text: `Application context: ${JSON.stringify(context)}\n\nMessage: ${message}`,
            }],
          },
        ],
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('OpenAI request failed:', data?.error?.message || response.statusText);
      return res.status(response.status === 429 ? 429 : 502).json({ error: data?.error?.message || 'OpenAI could not complete the request.' });
    }

    const text = data.output_text || data.output
      ?.flatMap((item) => item.content || [])
      ?.filter((item) => item.type === 'output_text')
      ?.map((item) => item.text)
      ?.join('\n') || 'Sentinel AI did not return a text response.';
    res.json({ message: text, model: data.model || process.env.OPENAI_MODEL || 'gpt-5-mini' });
  } catch (error) {
    next(error);
  }
}

module.exports = { chat };
