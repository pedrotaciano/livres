// Fontes da comunidade: links que as pessoas indicam para um livro. O livres não hospeda arquivo
// nenhum, só o link. Cada fonte é um JSON no Vercel Blob (fontes/<chave>/<id>.json) e nunca é
// reescrita; cada denúncia é outro arquivo (denuncias/<chave>/<id>/…), então duas pessoas
// escrevendo ao mesmo tempo nunca se atropelam. Com 3 denúncias o link some até alguém revisar
// (README, "Moderação").

import { list, put } from "@vercel/blob";
import { chave, CHAVE } from "./texto.js";

// Cada fonte é digital (ebook, leitura online, audiolivro) ou física (livro de papel: sebo, livraria,
// biblioteca) e tem preço em centavos: 0 é grátis, null é "não informado".
export const FORMATOS = { digital: "digital", fisico: "físico" };
const PRECO_MAXIMO = 1_000_000; // R$ 10.000
export const LIMITE_DENUNCIAS = 3;
export const MOTIVOS = ["pirataria", "link quebrado", "livro errado", "spam ou golpe", "outro"];

const texto = (v, max) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

// "28,30", "R$ 1.234,56", "28.30", "30" → centavos; "" → null (não informado).
export function lerPreco(valor) {
  const s = String(valor ?? "").replace(/r\$|\s/gi, "");
  if (!s) return null;
  const decimal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : /^\d+\.\d{1,2}$/.test(s) ? s : s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(decimal)) throw new Error("Não entendi o preço: escreva como 28,30.");
  const centavos = Math.round(Number(decimal) * 100);
  if (centavos > PRECO_MAXIMO) throw new Error("Preço alto demais para um livro.");
  return centavos;
}

// Devolve a fonte pronta para guardar ou lança um erro que pode ir direto para a tela.
export function validar(dados) {
  const titulo = texto(dados?.titulo, 200);
  const autor = texto(dados?.autor, 200);
  const k = chave(titulo, autor);
  if (!titulo || !CHAVE.test(k)) throw new Error("Falta o título do livro.");
  let url;
  try {
    url = new URL(texto(dados.url, 500));
  } catch {
    throw new Error("Esse link não parece um endereço da web.");
  }
  if (!["https:", "http:"].includes(url.protocol) || !url.hostname.includes(".")) throw new Error("Esse link não parece um endereço da web.");
  if (url.username || url.password) throw new Error("Tire usuário e senha do link.");
  if (!(dados.formato in FORMATOS)) throw new Error("Escolha digital ou físico.");
  const preco = dados.gratis === true ? 0 : lerPreco(dados.preco);
  return { chave: k, titulo, autor, url: url.href, dominio: url.hostname.replace(/^www\./, ""), formato: dados.formato, preco, nota: texto(dados.nota, 140) };
}

async function listarTudo(prefix) {
  const blobs = [];
  let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return blobs;
}

const ler = async (blob) => (await fetch(blob.url)).json();

// id da fonte → número de denúncias
async function denunciasPorFonte(prefixo) {
  const contagem = {};
  for (const b of await listarTudo(prefixo)) {
    const id = b.pathname.split("/")[2];
    contagem[id] = (contagem[id] || 0) + 1;
  }
  return contagem;
}

export async function fontesDoLivro(k) {
  const [blobs, denuncias] = await Promise.all([listarTudo(`fontes/${k}/`), denunciasPorFonte(`denuncias/${k}/`)]);
  const fontes = await Promise.all(blobs.map(ler));
  return fontes.filter((f) => (denuncias[f.id] || 0) < LIMITE_DENUNCIAS).sort((a, b) => a.criada.localeCompare(b.criada));
}

export async function adicionarFonte(dados) {
  const fonte = validar(dados);
  const existentes = await Promise.all((await listarTudo(`fontes/${fonte.chave}/`)).map(ler));
  if (existentes.some((f) => f.url === fonte.url)) throw Object.assign(new Error("Esse link já está aqui."), { status: 409 });
  const registro = { id: crypto.randomUUID().replace(/-/g, "").slice(0, 12), ...fonte, criada: new Date().toISOString() };
  await put(`fontes/${fonte.chave}/${registro.id}.json`, JSON.stringify(registro), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
  return registro;
}

export async function denunciar({ titulo, autor, id, motivo }) {
  const k = chave(texto(titulo, 200), texto(autor, 200));
  if (!CHAVE.test(k) || !/^[a-f0-9]{12}$/.test(id || "")) throw new Error("Denúncia sem livro ou sem link.");
  if (!MOTIVOS.includes(motivo)) throw new Error("Escolha o motivo.");
  const existe = (await listarTudo(`fontes/${k}/${id}.json`)).length > 0;
  if (!existe) throw Object.assign(new Error("Esse link não existe mais."), { status: 404 });
  await put(`denuncias/${k}/${id}/${Date.now()}.json`, JSON.stringify({ motivo, em: new Date().toISOString() }), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: true,
  });
}

// As últimas fontes indicadas, para a página inicial.
export async function recentes(quantas = 12) {
  const [blobs, denuncias] = await Promise.all([listarTudo("fontes/"), denunciasPorFonte("denuncias/")]);
  const ultimas = blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).slice(0, quantas * 2);
  const fontes = await Promise.all(ultimas.map(ler));
  return fontes.filter((f) => (denuncias[f.id] || 0) < LIMITE_DENUNCIAS).slice(0, quantas);
}
