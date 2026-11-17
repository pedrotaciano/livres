// sebo local: os mesmos arquivos e as mesmas funções de /api que a Vercel serve.

import { POST as estante } from "./api/estante.js";
import { GET as preco } from "./api/preco.js";

// 4190 (ManageSieve) está na lista de portas que os navegadores recusam; 4192 não.
const PORTA = Number(process.env.PORT) || 4192;
// main.js, não app.js: a Vercel trata um app.js na raiz como servidor Express
const ARQUIVOS = new Set(["/index.html", "/main.js", "/styles.css", "/icon.svg", "/lib/goodreads.js"]);
// o CDN da Vercel guarda os preços por 6 h; aqui um Map faz o papel dele
const cache = new Map();
const VALIDADE = 6 * 60 * 60 * 1000;

async function precoComCache(req) {
  const chave = new URL(req.url).search;
  const guardado = cache.get(chave);
  if (guardado && Date.now() - guardado.quando < VALIDADE) return new Response(guardado.corpo, guardado.init);
  const r = await preco(req);
  const corpo = await r.text();
  const init = { status: r.status, headers: { "content-type": "application/json" } };
  if (r.ok) cache.set(chave, { quando: Date.now(), corpo, init });
  return new Response(corpo, init);
}

const servidor = Bun.serve({
  port: PORTA,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname === "/api/estante" && req.method === "POST") return estante(req);
    if (pathname === "/api/preco" && req.method === "GET") return precoComCache(req);
    const caminho = pathname === "/" ? "/index.html" : pathname;
    if (ARQUIVOS.has(caminho)) return new Response(Bun.file(import.meta.dir + caminho));
    return new Response("não achei", { status: 404 });
  },
});

console.log(`sebo em ${servidor.url}`);
