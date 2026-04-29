const TARGET_BASE = (Netlify.env.get("TARGET_DOMAIN") || "").replace(/\/$/, "");
const SECRET_PATH = "/sinazeraatkar";

const STRIP_HEADERS = new Set([
  "host", "connection", "keep-alive", "proxy-authenticate", 
  "proxy-authorization", "te", "trailer", "transfer-encoding", 
  "upgrade", "forwarded", "x-forwarded-host", "x-forwarded-proto", 
  "x-forwarded-port", "x-real-ip", "x-forwarded-for"
]);

export default async function handler(request, context) {
  const url = new URL(request.url);

  if (!url.pathname.startsWith(SECRET_PATH)) {
    return context.next(); 
  }

  if (!TARGET_BASE) return new Response("Not Found", { status: 404 });

  try {
    const targetUrl = new URL(TARGET_BASE);
    const destination = TARGET_BASE + url.pathname + url.search;
    const headers = new Headers();

    for (const [key, value] of request.headers) {
      const k = key.toLowerCase();
      if (STRIP_HEADERS.has(k) || k.startsWith("x-nf-") || k.startsWith("x-netlify-")) continue;
      headers.set(k, value);
    }

    headers.set("host", targetUrl.host);
    headers.set("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

    const method = request.method;
    const fetchOptions = { method, headers, redirect: "manual" };
    if (method !== "GET" && method !== "HEAD") fetchOptions.body = request.body;

    const upstream = await fetch(destination, fetchOptions);
    const responseHeaders = new Headers();
    
    for (const [key, value] of upstream.headers) {
      if (key.toLowerCase() === "transfer-encoding") continue;
      responseHeaders.set(key, value);
    }

    // --- OPTIMIZATION: STRICT NO-CACHE ---
    // This stops Netlify from buffering your VPN traffic in their CDN memory.
    // It reduces compute time, speeds up the stream, and lowers ban risk.
    responseHeaders.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    responseHeaders.set("pragma", "no-cache");
    responseHeaders.set("expires", "0");

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });

  } catch (error) {
    return new Response("Not Found", { status: 404 });
  }
}