// POST /api/estante { rss } → { livros }. O CSV é lido no navegador e não passa por aqui;
// o RSS precisa do servidor porque o Goodreads não aceita chamadas de outra origem.
// O link traz a chave da conta: é usado para esta leitura e não fica guardado.

import { lerRss } from "../lib/goodreads.js";

export async function POST(req) {
  const { rss } = await req.json().catch(() => ({}));
  try {
    const livros = await lerRss(rss);
    if (!livros.length) return Response.json({ erro: "Nenhum livro na estante want-to-read." }, { status: 404 });
    return Response.json({ livros });
  } catch (e) {
    return Response.json({ erro: e.message }, { status: 400 });
  }
}
