const TARGET_BASE = (Netlify.env.get("TARGET_DOMAIN") || "").replace(/\/$/, "");
const SECRET_PATH = "/sinazeraatkar";

export default async function handler(request, context) {
  const url = new URL(request.url);

  // LOG 1: Check if it's hitting the decoy
  if (!url.pathname.startsWith(SECRET_PATH)) {
      console.log("🟡 DECOY HIT: Someone visited", url.pathname);
      return context.next(); 
  }

  console.log("🔥 VPN TRAFFIC DETECTED FOR:", SECRET_PATH);
  console.log("🎯 CURRENT TARGET_DOMAIN IS:", TARGET_BASE ? TARGET_BASE : "MISSING!");

  if (!TARGET_BASE) {
      console.error("🚨 ERROR: TARGET_DOMAIN variable is empty!");
      return new Response("Missing Target", { status: 500 });
  }

  try {
    const targetUrl = TARGET_BASE + url.pathname + url.search;
    console.log("➡️ ROUTING TRAFFIC TO:", targetUrl);

    const headers = new Headers(request.headers);
    const method = request.method;
    const fetchOptions = { method, headers, redirect: "manual" };
    if (method !== "GET" && method !== "HEAD") fetchOptions.body = request.body;

    // The actual connection attempt
    const upstream = await fetch(targetUrl, fetchOptions);
    
    console.log("✅ CONNECTION SUCCESS! Backend returned status:", upstream.status);

    return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
    
  } catch (error) {
    // LOG 2: If the connection dies, tell us EXACTLY why
    console.error("🚨 CRITICAL FETCH ERROR:", error.message);
    return new Response("Relay Failed", { status: 502 });
  }
}