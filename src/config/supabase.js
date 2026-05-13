const env = require('./env');

async function supabaseRequest(path, options = {}) {
  const res = await fetch(`${env.supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: env.supabaseKey,
      Authorization: `Bearer ${env.supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...options.headers,
    },
  });

  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { data, status: res.status, ok: res.ok };
}

module.exports = supabaseRequest;
