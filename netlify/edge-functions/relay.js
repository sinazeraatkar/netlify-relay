const TARGET_BASE = (Netlify.env.get("TARGET_DOMAIN") || "").replace(/\/$/, "");
const SECRET_PATH = "/sinazeraatkar";

// Headers to strip to hide the proxy and prevent 404/403 errors
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
  "x-real-ip",
  "x-forwarded-for"
]);

export default async function handler(request, context) {
  const url = new URL(request.url);

  // 1. DECOY SYSTEM: If not the secret path, show the index.html
  if (!url.pathname.startsWith(SECRET_PATH)) {
    return context.next(); 
  }

  if (!TARGET_BASE) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    const targetUrl = new URL(TARGET_BASE);
    const destination = TARGET_BASE + url.pathname + url.search;
    
    const headers = new Headers();

    // 2. HEADER CLEANING
    for (const [key, value] of request.headers) {
      const k = key.toLowerCase();
      if (STRIP_HEADERS.has(k) || k.startsWith("x-nf-") || k.startsWith("x-netlify-")) continue;
      headers.set(k, value);
    }

    // 3. THE 404 FIX: Set the Host header to match your backend domain
    // This is why your server was returning 404; it didn't recognize the Netlify host.
    headers.set("host", targetUrl.host);

    // 4. OBFUSCATION: Mask User-Agent
    headers.set("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

    const method = request.method;
    const fetchOptions = {
      method,
      headers,
      redirect: "manual",
    };

    if (method !== "GET" && method !== "HEAD") {
      fetchOptions.body = request.body;
    }

    const upstream = await fetch(destination, fetchOptions);

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
    // 5. SILENT ERROR: Standard 404 instead of proxy errors
    return new Response("Not Found", { status: 404 });
  }
}