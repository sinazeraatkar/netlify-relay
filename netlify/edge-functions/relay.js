const TARGET_BASE = (Netlify.env.get("TARGET_DOMAIN") || "").replace(/\/$/, "");

// 1. YOUR SECRET V2RAY PATH
const SECRET_PATH = "/sinazeraatkar";

// 2. STRIP HEADERS (Now includes IP stripping to hide proxy identity)
const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-real-ip",        // Added: Hides client IP from logs
  "x-forwarded-for"   // Added: Prevents DPI from identifying this as a proxy
]);

export default async function handler(request, context) {
  const url = new URL(request.url);

  // --- STEALTH FEATURE 1: ANTI-ACTIVE PROBING DECOY ---
  // If the path does not match your secret Xray path, serve the normal website
  if (!url.pathname.startsWith(SECRET_PATH)) {
    return context.next(); 
  }

  // Failsafe if TARGET_DOMAIN is missing in Netlify settings
  if (!TARGET_BASE) {
    return new Response("404 Not Found", { status: 404 });
  }

  try {
    const targetUrl = TARGET_BASE + url.pathname + url.search;
    const headers = new Headers();

    // Clean the headers
    for (const [key, value] of request.headers) {
      const k = key.toLowerCase();
      if (STRIP_HEADERS.has(k)) continue;
      if (k.startsWith("x-nf-")) continue;
      if (k.startsWith("x-netlify-")) continue;
      headers.set(k, value);
    }

    // --- STEALTH FEATURE 2: FORCED USER-AGENT ---
    // Overwrite V2Ray client fingerprints to look like normal Chrome traffic
    headers.set("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

    const method = request.method;
    const hasBody = method !== "GET" && method !== "HEAD";

    const fetchOptions = {
      method,
      headers,
      redirect: "manual",
    };

    if (hasBody) {
      fetchOptions.body = request.body;
    }

    const upstream = await fetch(targetUrl, fetchOptions);

    const responseHeaders = new Headers();
    for (const [key, value] of upstream.headers) {
      if (key.toLowerCase() === "transfer-encoding") continue;
      responseHeaders.set(key, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    // --- STEALTH FEATURE 3: FAKE ERRORS ---
    // Replaced the obvious "Bad Gateway: Relay Failed" proxy error with a standard 404
    return new Response("404 Not Found", { status: 404 });
  }
}