// Used only by server route handlers. Never expose this key to the browser.
export function researchApiHeaders(): HeadersInit {
  return process.env.RESEARCH_API_KEY
    ? { Authorization: `Bearer ${process.env.RESEARCH_API_KEY}` }
    : {};
}
