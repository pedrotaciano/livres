// GET /api/vitrine → { livros }: a estante viva do início. O CDN guarda 15 min, então uma indicação
// nova aparece aqui em até 15 min, e a Open Library recebe uma busca a cada 15 min, não uma por visita.

import { vitrine } from "../lib/vitrine.js";

const QUINZE_MIN = 15 * 60;

export async function GET() {
  try {
    return Response.json({ livros: await vitrine() }, { headers: { "cache-control": `public, s-maxage=${QUINZE_MIN}, stale-while-revalidate=${QUINZE_MIN * 4}` } });
  } catch (e) {
    return Response.json({ erro: e.message }, { status: 502 });
  }
}
