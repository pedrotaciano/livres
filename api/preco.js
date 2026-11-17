// GET /api/preco?titulo=…&autor=…&isbn=…,… → menor preço na Estante Virtual.
// É GET para o CDN guardar a resposta: o mesmo livro pedido por outra pessoa não vira outra
// busca na Estante (que tem anti-robô) durante 6 h.

import { melhorPreco } from "../lib/estante.js";

const VALIDADE = 6 * 60 * 60; // s

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const livro = {
    titulo: p.get("titulo") || "",
    autor: p.get("autor") || "",
    isbn: (p.get("isbn") || "").split(",").filter((i) => /^97[89]\d{10}$/.test(i)),
  };
  if (!livro.titulo) return Response.json({ erro: "Livro sem título." }, { status: 400 });
  try {
    return Response.json(await melhorPreco(livro), {
      headers: { "cache-control": `public, s-maxage=${VALIDADE}, stale-while-revalidate=${VALIDADE}` },
    });
  } catch (e) {
    return Response.json({ erro: e.message }, { status: 502 });
  }
}
