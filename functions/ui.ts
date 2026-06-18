/**
 * AuthOrigin UI — serves the interactive dashboard as a live web page
 */
Deno.serve(async (req) => {
  try {
    const resp = await fetch(
      'https://base44.app/api/apps/6a32de057455bcc09670b3aa/files/mp/public/6a32de057455bcc09670b3aa/77c66c5c7_authorigin.html'
    );
    const html = await resp.text();
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Frame-Options': 'SAMEORIGIN'
      }
    });
  } catch (e: any) {
    return new Response(`<html><body style="background:#0a0a0f;color:#e2e2f0;font-family:monospace;padding:40px">
      <h2 style="color:#e05252">UI load error</h2><pre>${e.message}</pre>
    </body></html>`, {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
});
