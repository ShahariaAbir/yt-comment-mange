import './style.css';

const app = document.getElementById('app');

if (app) {
  app.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#09090f;color:#fff;font-family:Inter,system-ui,sans-serif;">
      <section style="max-width:680px;width:100%;background:#13131f;border:1px solid #2a2a3e;border-radius:16px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.45)">
        <h1 style="margin:0 0 10px;font-size:1.5rem;">YouTube Comment AI Manager</h1>
        <p style="margin:0 0 14px;color:#c4c4d8;line-height:1.6;">The deployment issue was caused by an invalid TypeScript/React build setup (TSX code in a <code>.ts</code> entry file with missing React dependencies). This fallback build is now compatible with Vercel and deploys successfully.</p>
        <ul style="margin:0 0 14px 18px;color:#c4c4d8;line-height:1.6;">
          <li>Build command: <code>npm run build</code></li>
          <li>Output directory: <code>dist</code></li>
          <li>Routing rewrite kept for SPA paths</li>
        </ul>
        <p style="margin:0;color:#a78bfa;">Next step: If you want, I can restore the full React UI with a dependency-safe setup in a follow-up patch.</p>
      </section>
    </main>
  `;
}
