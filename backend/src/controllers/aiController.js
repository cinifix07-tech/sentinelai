const OPENAI_URL = 'https://api.openai.com/v1/responses';
function writeEvent(res, event, payload) { res.write(`event: ${event}\\ndata: ${JSON.stringify(payload)}\\n\\n`); }
async function chat(req, res, next) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'OpenAI is not configured. Add OPENAI_API_KEY to the Vercel backend environment.' });
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'A message is required.' });
    if (message.length > 4000) return res.status(400).json({ error: 'Message must be 4000 characters or fewer.' });
    const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5-mini', service_tier: 'default', store: true, stream: true,
        input: [
          { role: 'developer', content: [{ type: 'input_text', text: 'You are Sentinel AI, a concise admin access-control assistant for a home-security system. Help authorized administrators review security state, access requests, device status, and safe next steps. Never claim that a door is unlocked or that an access decision is authorized unless the application explicitly reports that state. Never impersonate a visitor. Keep replies under 120 words.' }] },
          { role: 'user', content: [{ type: 'input_text', text: `Application context: ${JSON.stringify(context)}\n\nMessage: ${message}` }] },
        ],
        text: { format: { type: 'text' }, verbosity: 'medium' }, reasoning: { effort: 'medium', summary: 'auto' },
        include: ['reasoning.encrypted_content', 'web_search_call.action.sources'],
      }),
    });
    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({}));
      console.error('OpenAI request failed:', data?.error?.message || response.statusText);
      return res.status(response.status === 429 ? 429 : 502).json({ error: data?.error?.message || 'OpenAI could not start the response stream.' });
    }
    res.status(200); res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders?.();
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
    while (true) {
      const { done, value } = await reader.read(); buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split(/\n\n/); buffer = events.pop() || '';
      for (const rawEvent of events) {
        const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data: ')); if (!dataLine) continue;
        const event = JSON.parse(dataLine.slice(6));
        if (event.type === 'response.output_text.delta' || event.type === 'response.refusal.delta') writeEvent(res, 'delta', { text: event.delta || '' });
        else if (event.type === 'response.failed') writeEvent(res, 'error', { error: event.response?.error?.message || 'Response generation failed.' });
        else if (event.type === 'response.completed') writeEvent(res, 'done', { model: event.response?.model || process.env.OPENAI_MODEL || 'gpt-5-mini' });
      }
      if (done) break;
    }
    res.end();
  } catch (error) {
    if (!res.headersSent) return next(error);
    writeEvent(res, 'error', { error: error instanceof Error ? error.message : 'Response generation failed.' }); res.end();
  }
}

module.exports = { chat };
