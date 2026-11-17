// /api/fontes: os links que as pessoas indicam para um livro.
// GET ?titulo=…&autor=… → { fontes } · POST { titulo, autor, url, tipo, nota } → { fonte }

import { adicionarFonte, fontesDoLivro } from "../lib/fontes.js";
import { chave, CHAVE } from "../lib/texto.js";

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const k = chave(p.get("titulo") || "", p.get("autor") || "");
  if (!CHAVE.test(k)) return Response.json({ erro: "Livro sem título." }, { status: 400 });
  try {
    return Response.json({ fontes: await fontesDoLivro(k) }, { headers: { "cache-control": "public, s-maxage=15, stale-while-revalidate=60" } });
  } catch (e) {
    return Response.json({ erro: e.message }, { status: 502 });
  }
}

export async function POST(req) {
  const dados = await req.json().catch(() => null);
  // campo escondido na página: só robô preenche
  if (dados?.site) return Response.json({ erro: "Não deu." }, { status: 400 });
  try {
    return Response.json({ fonte: await adicionarFonte(dados) }, { status: 201 });
  } catch (e) {
    return Response.json({ erro: e.message }, { status: e.status || 400 });
  }
}
