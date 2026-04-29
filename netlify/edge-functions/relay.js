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

  // DEBUG 1: Is the variable missing?
  if (!TARGET_BASE) {
      console.error("🚨 ERROR: TARGET_DOMAIN is missing in Netlify settings!");
      return new Response("404 Not Found", { status: 404 });
  }

  try {
    const targetUrl = TARGET_BASE + url.pathname + url.search;
    console.log("➡️ Routing to:", targetUrl);

    const headers = new Headers();
    for (const [key, value] of request.headers) {
      const k = key.toLowerCase();
      if (STRIP_HEADERS.has(k) || k.startsWith("x-nf-") || k.startsWith("x-netlify-")) continue;
      headers.set(k, value);
    }

    headers.set("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

    const method = request.method;
    const fetchOptions = { method, headers, redirect: "manual" };
    if (method !== "GET" && method !== "HEAD") fetchOptions.body = request.body;

    const upstream = await fetch(targetUrl, fetchOptions);
    const responseHeaders = new Headers();
    
    for (const [key, value] of upstream.headers) {
      if (key.toLowerCase() === "transfer-encoding") continue;
      responseHeaders.set(key, value);
    }

    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
    
  } catch (error) {
    // DEBUG 2: Did the network block the port?
    console.error("🚨 ERROR: Fetch failed! Reason:", error.message);
    return new Response("404 Not Found", { status: 404 });
  }
}