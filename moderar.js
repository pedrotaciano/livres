#!/usr/bin/env bun
// Moderação das fontes da comunidade. Precisa do BLOB_READ_WRITE_TOKEN (npx vercel env pull).
//
//   bun moderar.js                 links denunciados, com os motivos (os escondidos primeiro)
//   bun moderar.js recentes        as últimas fontes, denunciadas ou não
//   bun moderar.js remover <id>    apaga o link e as denúncias dele
//   bun moderar.js manter <id>     apaga só as denúncias: o link volta a aparecer

import { del, list } from "@vercel/blob";
import { LIMITE_DENUNCIAS } from "./lib/fontes.js";

async function tudo(prefix) {
  const blobs = [];
  let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return blobs;
}

const ler = async (b) => (await fetch(b.url)).json();
const fonteDe = async (id) => (await tudo("fontes/")).find((b) => b.pathname.endsWith(`/${id}.json`));
const mostrar = (f) => `${f.id}  ${f.titulo} — ${f.autor}\n              ${TIPO[f.tipo] || f.tipo} · ${f.url}${f.nota ? `\n              “${f.nota}”` : ""}`;
const TIPO = { gratis: "grátis", biblioteca: "biblioteca", compra: "compra", audio: "audiolivro", outro: "outro" };

const [comando = "denuncias", id] = process.argv.slice(2);

if (comando === "denuncias") {
  const porFonte = new Map();
  for (const b of await tudo("denuncias/")) {
    const [, chave, fid] = b.pathname.split("/");
    if (!porFonte.has(fid)) porFonte.set(fid, { chave, blobs: [] });
    porFonte.get(fid).blobs.push(b);
  }
  if (!porFonte.size) console.log("Nenhuma denúncia.");
  const ordem = [...porFonte].sort((a, b) => b[1].blobs.length - a[1].blobs.length);
  for (const [fid, { blobs }] of ordem) {
    const b = await fonteDe(fid);
    const motivos = (await Promise.all(blobs.map(ler))).map((d) => d.motivo);
    const estado = blobs.length >= LIMITE_DENUNCIAS ? "ESCONDIDO" : "visível";
    console.log(`${String(blobs.length).padStart(2)} denúncias · ${estado} · ${motivos.join(", ")}`);
    console.log(b ? `   ${mostrar(await ler(b))}\n` : `   ${fid} (o link já foi apagado)\n`);
  }
} else if (comando === "recentes") {
  const blobs = (await tudo("fontes/")).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).slice(0, 30);
  for (const b of blobs) console.log(`${b.uploadedAt.toISOString?.() ?? b.uploadedAt}  ${mostrar(await ler(b))}\n`);
} else if ((comando === "remover" || comando === "manter") && /^[a-f0-9]{12}$/.test(id || "")) {
  const b = await fonteDe(id);
  if (!b) {
    console.error(`Não achei o link ${id}.`);
    process.exit(1);
  }
  const chave = b.pathname.split("/")[1];
  const denuncias = await tudo(`denuncias/${chave}/${id}/`);
  const apagar = [...denuncias.map((d) => d.url), ...(comando === "remover" ? [b.url] : [])];
  if (apagar.length) await del(apagar);
  console.log(comando === "remover" ? `Apagado: ${id} e ${denuncias.length} denúncias.` : `${id} mantido; ${denuncias.length} denúncias apagadas.`);
} else {
  console.error("uso: bun moderar.js [denuncias | recentes | remover <id> | manter <id>]");
  process.exit(1);
}
