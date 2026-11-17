// A wishlist do Goodreads. O Goodreads fechou a API em 2020; sobram duas portas:
// o RSS da estante (link "RSS" no pé da página da estante, com a chave da conta)
// e o CSV de My Books → Import and export → Export Library.

// ---------- ISBN ----------

export function isbn13(valor) {
  const s = String(valor || "").toUpperCase().replace(/[^0-9X]/g, "");
  if (/^97[89]\d{10}$/.test(s)) return s;
  if (!/^\d{9}[\dX]$/.test(s)) return null;
  const base = "978" + s.slice(0, 9);
  const soma = [...base].reduce((t, d, i) => t + Number(d) * (i % 2 ? 3 : 1), 0);
  return base + ((10 - (soma % 10)) % 10);
}

const isbns = (...valores) => [...new Set(valores.map(isbn13).filter(Boolean))];

// ---------- CSV (RFC 4180: aspas, vírgulas e quebras de linha dentro do campo) ----------

export function parseCsv(texto) {
  const linhas = [];
  let linha = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') (campo += '"'), i++;
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") linha.push(campo), (campo = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      linha.push(campo), linhas.push(linha), (linha = []), (campo = "");
    } else campo += c;
  }
  if (campo || linha.length) linha.push(campo), linhas.push(linha);
  return linhas.filter((l) => l.some((c) => c.trim()));
}

// O export marca o ISBN como fórmula de planilha: ="0060916303"
const semFormula = (s = "") => s.replace(/^="?|"$/g, "");

export function livrosDoCsv(texto, estante = "to-read") {
  const [cabecalho, ...linhas] = parseCsv(texto.replace(/^\uFEFF/, ""));
  const col = (nome) => cabecalho?.indexOf(nome) ?? -1;
  const c = { id: col("Book Id"), titulo: col("Title"), autor: col("Author"), isbn: col("ISBN"), isbn13: col("ISBN13"), estante: col("Exclusive Shelf") };
  if (c.titulo < 0 || c.autor < 0 || c.estante < 0) throw new Error("Esse CSV não é o export do Goodreads (faltam Title, Author ou Exclusive Shelf).");
  return linhas
    .filter((l) => l[c.estante] === estante)
    .map((l) => ({
      id: l[c.id],
      titulo: l[c.titulo],
      autor: l[c.autor],
      isbn: isbns(semFormula(l[c.isbn]), semFormula(l[c.isbn13])),
      capa: null,
      url: l[c.id] ? `https://www.goodreads.com/book/show/${l[c.id]}` : null,
    }));
}

// ---------- RSS ----------

const entidades = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const desescapa = (s) =>
  s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (entidades[e] ?? m),
  );

function tag(xml, nome) {
  const m = xml.match(new RegExp(`<${nome}>([\\s\\S]*?)</${nome}>`));
  if (!m) return "";
  const cdata = m[1].match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return (cdata ? cdata[1] : desescapa(m[1])).trim();
}

export function livrosDoRss(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const id = tag(item, "book_id");
    return {
      id,
      titulo: tag(item, "title"),
      autor: tag(item, "author_name"),
      isbn: isbns(tag(item, "isbn"), tag(item, "isbn13")),
      capa: tag(item, "book_large_image_url") || tag(item, "book_medium_image_url") || tag(item, "book_image_url") || null,
      url: id ? `https://www.goodreads.com/book/show/${id}` : tag(item, "link") || null,
    };
  });
}

// Aceita o link do RSS como vem do Goodreads; qualquer outro link de perfil ou estante
// vira uma mensagem dizendo onde achar o certo.
export function urlDoRss(entrada) {
  let u;
  try {
    u = new URL(String(entrada).trim());
  } catch {
    throw new Error("Cole o link do RSS da estante ou envie o CSV do Goodreads.");
  }
  const id = u.pathname.match(/\/(?:review\/list(?:_rss)?|user\/show)\/(\d+)/)?.[1];
  if (!/(^|\.)goodreads\.com$/.test(u.hostname) || !id) throw new Error("Esse link não é do Goodreads.");
  if (!u.pathname.includes("/review/list_rss/") || !u.searchParams.get("key"))
    throw new Error("O Goodreads só entrega a estante pelo RSS com a chave da conta: abra a estante want-to-read, role até o fim e copie o link “RSS”.");
  const rss = new URL(`https://www.goodreads.com/review/list_rss/${id}`);
  rss.searchParams.set("key", u.searchParams.get("key"));
  rss.searchParams.set("shelf", u.searchParams.get("shelf") || "to-read");
  return rss;
}

// O RSS vem em páginas; para quando uma página vem vazia ou só repete livros.
export async function lerRss(entrada, { fetch = globalThis.fetch, maxPaginas = 50 } = {}) {
  const base = urlDoRss(entrada);
  const livros = new Map();
  for (let pagina = 1; pagina <= maxPaginas; pagina++) {
    base.searchParams.set("page", pagina);
    const r = await fetch(base, { headers: { "user-agent": "Mozilla/5.0" } });
    if (r.status === 404) throw new Error("O Goodreads não achou essa estante: confira se o link do RSS está inteiro, com a chave.");
    if (!r.ok) throw new Error(`O Goodreads respondeu ${r.status}.`);
    const novos = livrosDoRss(await r.text()).filter((l) => !livros.has(l.id));
    if (!novos.length) break;
    for (const l of novos) livros.set(l.id, l);
  }
  return [...livros.values()];
}
