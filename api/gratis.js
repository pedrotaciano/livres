// GET /api/gratis?titulo=…&autor=… → { fontes }: onde ler de graça, achado sozinho (Open Library).
// O CDN guarda 24 h.

import { fontesGratis } from "../lib/gratis.js";

const DIA = 24 * 60 * 60;

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const livro = { titulo: p.get("titulo") || "", autor: p.get("autor") || "" };
  if (!livro.titulo) return Response.json({ erro: "Livro sem título." }, { status: 400 });
  try {
    return Response.json({ fontes: await fontesGratis(livro) }, { headers: { "cache-control": `public, s-maxage=${DIA}, stale-while-revalidate=${DIA}` } });
  } catch (e) {
    return Response.json({ erro: e.message }, { status: 502 });
  }
}
