// POST /api/denuncia { titulo, autor, id, motivo }. Com 3 denúncias o link some até ser revisado.

import { denunciar } from "../lib/fontes.js";

export async function POST(req) {
  const dados = await req.json().catch(() => ({}));
  try {
    await denunciar(dados);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ erro: e.message }, { status: e.status || 400 });
  }
}
