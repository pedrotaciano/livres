// GET /api/recentes → { fontes }: as últimas fontes indicadas, para a página inicial.

import { recentes } from "../lib/fontes.js";

export async function GET() {
  try {
    return Response.json({ fontes: await recentes() }, { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (e) {
    return Response.json({ erro: e.message }, { status: 502 });
  }
}
