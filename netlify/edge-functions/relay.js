const TARGET_BASE = (Netlify.env.get("TARGET_DOMAIN") || "").replace(/\/$/, "");

// 1. YOUR SECRET V2RAY PATH
const SECRET_PATH = "/sinazeraatkar";

// 2. STRIP ALL PROXY & IP TRACES
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
  "x-real-ip",        // Hides client IP from Netlify logs
  "x-forwarded-for"   // Hides proxy identity
]);

export default async function handler(request, context) {
  const url = new URL(request.url);

  // --- THE STEALTH DECOY ---
  // If the path does NOT exactly match your secret path,
  // we tell Netlify to serve the innocent public/index.html file.
  if (!url.pathname.startsWith(SECRET_PATH)) {
      return context.next(); 
  }

  // Failsafe: If you forgot to set TARGET_DOMAIN in Netlify settings
  if (!TARGET_BASE) {
      return new Response("404 Not Found", { status: 404 });
  }

  try {
    const targetUrl = TARGET_BASE + url.pathname + url.search;
    const headers = new Headers();

    // Clean headers to hide tracks
    for (const [key, value] of request.headers) {
      const k = key.toLowerCase();
      if (STRIP_HEADERS.has(k)) continue;
      if (k.startsWith("x-nf-")) continue;
      if (k.startsWith("x-netlify-")) continue;
      headers.set(k, value);
    }

    // Forcefully mask the User-Agent so you look like Chrome on Windows
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

    // Connect to your DigitalOcean backend
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
    // If the proxy fails, throw a boring 404 error instead of a "Bad Gateway" proxy error
    return new Response("404 Not Found", { status: 404 });
  }
}