// Vercel serverless function: /api/chat
// Keeps the OpenRouter API key on the server, forwards chat requests from the browser.
// Uses OpenRouter's free-model auto-router so the app keeps working even as
// specific free models rotate in/out on their platform.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing OPENROUTER_API_KEY. Set it in Vercel project settings.' });
    return;
  }

  const { system, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Missing "messages" array in request body.' });
    return;
  }

  // OpenRouter uses the OpenAI-compatible format: system prompt goes in the messages array.
  const chatMessages = system ? [{ role: 'system', content: system }, ...messages] : messages;

  try {
    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        // OpenRouter asks for these for their leaderboard/analytics; harmless to include.
        'HTTP-Referer': 'https://tessa-pa.vercel.app',
        'X-Title': 'Tessa PA'
      },
      body: JSON.stringify({
        model: 'openrouter/free', // auto-routes to an available free model
        max_tokens: 1000,
        messages: chatMessages
      })
    });

    const data = await orRes.json();

    if (!orRes.ok) {
      res.status(orRes.status).json({ error: data.error?.message || 'OpenRouter API error', details: data });
      return;
    }

    const reply = data.choices?.[0]?.message?.content || '';
    res.status(200).json({ reply, raw: data });
  } catch (err) {
    console.error('Chat proxy error:', err);
    res.status(500).json({ error: 'Failed to reach OpenRouter API.' });
  }
}
