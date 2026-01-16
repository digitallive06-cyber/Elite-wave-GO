const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function rewriteM3U8Content(content: string, baseUrl: string, proxyBaseUrl: string): string {
  const lines = content.split('\n');
  const rewrittenLines = lines.map(line => {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('#') || trimmedLine === '') {
      return line;
    }

    let absoluteUrl: string;
    if (trimmedLine.startsWith('http://') || trimmedLine.startsWith('https://')) {
      absoluteUrl = trimmedLine;
    } else {
      const base = new URL(baseUrl);
      if (trimmedLine.startsWith('/')) {
        absoluteUrl = `${base.protocol}//${base.host}${trimmedLine}`;
      } else {
        const pathParts = base.pathname.split('/');
        pathParts.pop();
        absoluteUrl = `${base.protocol}//${base.host}${pathParts.join('/')}/${trimmedLine}`;
      }
    }

    return `${proxyBaseUrl}?url=${encodeURIComponent(absoluteUrl)}`;
  });

  return rewrittenLines.join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const streamUrl = url.searchParams.get("url");

    if (!streamUrl) {
      return new Response(
        JSON.stringify({ error: "Missing url parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('Proxying:', streamUrl);

    const streamResponse = await fetch(streamUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "Connection": "keep-alive",
      },
    });

    if (!streamResponse.ok) {
      console.error('Stream fetch failed:', streamResponse.status, streamResponse.statusText);
      return new Response(
        JSON.stringify({
          error: "Stream fetch failed",
          status: streamResponse.status,
          statusText: streamResponse.statusText
        }),
        {
          status: streamResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const contentType = streamResponse.headers.get("content-type") || "";

    if (streamUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('m3u8')) {
      const manifestContent = await streamResponse.text();
      const proxyBaseUrl = `${url.protocol}//${url.host}${url.pathname}`;
      const rewrittenManifest = rewriteM3U8Content(manifestContent, streamUrl, proxyBaseUrl);

      console.log('Rewritten manifest with', rewrittenManifest.split('\n').length, 'lines');

      return new Response(rewrittenManifest, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      });
    } else {
      const responseBody = streamResponse.body;

      return new Response(responseBody, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType || "video/mp2t",
          "Cache-Control": "public, max-age=31536000",
          "Accept-Ranges": "bytes",
        },
      });
    }
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({
        error: "Proxy error",
        message: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
