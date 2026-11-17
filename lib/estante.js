// Estante Virtual: a página de busca traz os resultados num JSON embutido (window.__INITIAL_STATE__).
// Preços em centavos; cada resultado é um grupo de anúncios do mesmo livro, e o preço do grupo é o
// menor deles. O frete fica de fora: depende do CEP e do sebo.

import { isbn13 } from "./goodreads.js";
import { mesmaObra, sobrenome, tituloPrincipal } from "./texto.js";

export const ESTANTE = "https://www.estantevirtual.com.br";
// A Estante fica atrás do ShieldSquare. A página de busca aceita o "Mozilla/5.0" curto; o endpoint
// JSON (/busca/api) e um user-agent de Chrome sem o resto dos cabeçalhos caem no desafio (302 para
// validate.perfdrive.com). Uma busca por vez, com intervalo, para não parecer robô — e não ser um.
const UA = "Mozilla/5.0";
const INTERVALO = 800;

export const urlBusca = (q) => `${ESTANTE}/busca?q=${encodeURIComponent(q)}`;

let fila = Promise.resolve();
const naFila = (tarefa) => {
  const vez = fila.then(tarefa);
  fila = vez.catch(() => {}).then(() => new Promise((ok) => setTimeout(ok, INTERVALO)));
  return vez;
};

export function estadoDaPagina(html) {
  const marca = "window.__INITIAL_STATE__=";
  const inicio = html.indexOf(marca);
  if (inicio < 0) return null;
  const fim = html.indexOf("</script>", inicio);
  return JSON.parse(html.slice(inicio + marca.length, fim).trim().replace(/;$/, ""));
}

export function buscar(q, ordem = "relevance", { fetch = globalThis.fetch } = {}) {
  const u = new URL("/busca", ESTANTE);
  u.searchParams.set("q", q);
  u.searchParams.set("sort", ordem); // relevance · lowest-first
  return naFila(async () => {
    const r = await fetch(u, { headers: { "user-agent": UA }, redirect: "manual" });
    if (r.status === 302) throw new Error("A Estante Virtual pediu verificação anti-robô; espere uns minutos e tente de novo.");
    if (!r.ok) throw new Error(`A Estante Virtual respondeu ${r.status}.`);
    const busca = estadoDaPagina(await r.text())?.SearchPage;
    if (!busca) throw new Error("A página de busca da Estante Virtual mudou; o livres precisa de ajuste.");
    return busca.empty ? [] : busca.parentSkus || [];
  });
}

// ---------- anúncio ----------

export function anuncio(sku) {
  const attr = Object.fromEntries((sku.attributes || []).map((a) => [a.name, a.value]));
  const preco = Math.min(...[sku.salePrice, sku.discountPrice].filter((p) => p > 0));
  return {
    nome: sku.name,
    autor: attr.author || "",
    isbn: isbn13(attr.isbn),
    preco: Number.isFinite(preco) ? preco : null,
    condicao: [...new Set((sku.variations || []).map((v) => v.condition))],
    ofertas: (sku.variations || []).reduce((t, v) => t + (v.total || 0), 0) || 1,
    idioma: attr.language || null,
    ano: attr.year || null,
    editora: attr.publisher || null,
    capa: sku.image && !sku.image.includes("/indisponivel") ? sku.image : null, // sem foto a Estante manda "capa ilustrativa"
    url: sku.productSlug ? ESTANTE + sku.productSlug : null,
  };
}

// "edicao": mesmo ISBN do Goodreads; "obra": mesmo título e autor, outra edição; null: outro livro.
export function casa(livro, a) {
  if (a.isbn && livro.isbn.includes(a.isbn)) return "edicao";
  return mesmaObra(livro, a) ? "obra" : null;
}

// Três buscas por livro: o ISBN, e título + sobrenome por relevância e por menor preço.
// Só a ordem por preço deixaria o livro certo de fora quando a busca é larga ("1984" traz 1.300
// resultados, e os mais baratos são outros livros); só a relevância perderia o mais barato.
export async function melhorPreco(livro, opcoes = {}) {
  const q = `${tituloPrincipal(livro.titulo)} ${sobrenome(livro.autor)}`.trim();
  const buscas = [buscar(q, "relevance", opcoes), buscar(q, "lowest-first", opcoes)];
  if (livro.isbn[0]) buscas.push(buscar(livro.isbn[0], "lowest-first", opcoes));
  const vistos = new Map();
  for (const sku of (await Promise.all(buscas)).flat()) {
    const a = anuncio(sku);
    const tipo = a.preco != null && casa(livro, a);
    if (tipo && !vistos.has(a.url)) vistos.set(a.url, { ...a, tipo });
  }
  const achados = [...vistos.values()].sort((x, y) => x.preco - y.preco);
  return {
    melhor: achados[0] || null,
    // a mesma edição do Goodreads, quando não é ela a mais barata
    edicao: achados.find((a) => a.tipo === "edicao" && a !== achados[0]) || null,
    anuncios: achados.reduce((t, a) => t + a.ofertas, 0),
    busca: urlBusca(q),
  };
}
