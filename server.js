// livres local: os mesmos arquivos e as mesmas funções de /api que a Vercel serve.
// As fontes da comunidade usam o Blob de produção: `npx vercel env pull` grava o token em .env.local,
// que o Bun lê sozinho.

import * as denuncia from "./api/denuncia.js";
import * as estante from "./api/estante.js";
import * as fontes from "./api/fontes.js";
import * as gratis from "./api/gratis.js";
import * as preco from "./api/preco.js";
import * as vitrine from "./api/vitrine.js";

// 4190 (ManageSieve) está na lista de portas que os navegadores recusam; 4192 não.
const PORTA = Number(process.env.PORT) || 4192;
const API = { denuncia, estante, fontes, gratis, preco, vitrine };
// main.js, não app.js: a Vercel trata um app.js na raiz como servidor Express
const ARQUIVOS = new Set(["/index.html", "/main.js", "/styles.css", "/icon.svg", "/lib/goodreads.js", "/lib/texto.js"]);

// o CDN da Vercel guarda as respostas com s-maxage; aqui um Map faz o papel dele
const cache = new Map();

async function comCache(req, handler) {
  const chave = req.url;
  const guardado = cache.get(chave);
  if (guardado && Date.now() < guardado.ate) return new Response(guardado.corpo, guardado.init);
  const r = await handler(req);
  const corpo = await r.text();
  const init = { status: r.status, headers: { "content-type": "application/json" } };
  const segundos = Number(r.headers.get("cache-control")?.match(/s-maxage=(\d+)/)?.[1]);
  if (r.ok && segundos) cache.set(chave, { ate: Date.now() + segundos * 1000, corpo, init });
  return new Response(corpo, init);
}

const servidor = Bun.serve({
  port: PORTA,
  idleTimeout: 60,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const api = pathname.match(/^\/api\/([a-z]+)$/)?.[1];
    if (api) {
      const handler = API[api]?.[req.method];
      if (!handler) return Response.json({ erro: "não achei" }, { status: 404 });
      return req.method === "GET" ? comCache(req, handler) : handler(req);
    }
    const caminho = pathname === "/" ? "/index.html" : pathname;
    if (ARQUIVOS.has(caminho)) return new Response(Bun.file(import.meta.dir + caminho));
    return new Response("não achei", { status: 404 });
  },
});

console.log(`livres em ${servidor.url}`);
