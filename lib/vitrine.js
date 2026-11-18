// A estante viva do início: os livros que alguém indicou há pouco (com capa) e, completando,
// os livros com leitura aberta numa edição em português na Open Library, dos mais lidos para baixo.
// Cada livro traz a "resposta" que o livres dá a ele: formato e preço, ou grátis.

import { recentes } from "./fontes.js";
import { normaliza } from "./texto.js";

const PRAZO = 8000;
const QUANTOS = 36;

const precoTexto = (c) => (c === 0 ? "grátis" : c == null ? "ver preço" : (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const FORMATO = { digital: "digital", fisico: "físico" };

// "... Macunaíma" → "Macunaíma"; "Os Maias." → "Os Maias";
// "Memorial de Aires (Classicos Da Literatura Brasileira)" → "Memorial de Aires"
const limpar = (t = "") => t.replace(/^[.\s…]+/, "").replace(/\s*\([^)]*\)\s*$/, "").replace(/[\s.]+$/, "").trim();

// Para obras escritas em português o título da obra vem na grafia de hoje ("Memórias póstumas de
// Brás Cubas"); para traduções, o da edição em português ("Divina comedia", não "La Divina Commedia").
function tituloEmPortugues(obra, edicao) {
  const e = limpar(edicao?.title);
  if (!e) return limpar(obra.title);
  const primeira = (s) => normaliza(s).split(" ")[0];
  return primeira(e) === primeira(obra.title) ? limpar(obra.title) : e;
}

// A Open Library marca alguns livros recentes como leitura aberta (SPQR, de 2015, aparece). Para a
// vitrine ficam só obras publicadas antes de 1950, quase sempre em domínio público, e só quando a
// edição achada está mesmo em português.
const ATE = 1950;

export async function gratisEmPortugues({ fetch = globalThis.fetch } = {}) {
  const u = new URL("https://openlibrary.org/search.json");
  u.searchParams.set("q", `ebook_access:public language:por first_publish_year:[* TO ${ATE - 1}]`);
  u.searchParams.set("fields", "key,title,author_name,cover_i,editions,editions.title,editions.cover_i,editions.language");
  u.searchParams.set("sort", "readinglog");
  u.searchParams.set("limit", "80");
  const r = await fetch(u, { signal: AbortSignal.timeout(PRAZO), headers: { "user-agent": "sinco livres (+https://software.sinco.institute/livres/)" } });
  if (!r.ok) throw new Error(`A Open Library respondeu ${r.status}.`);
  const { docs = [] } = await r.json();
  return docs
    .map((d) => {
      const edicao = d.editions?.docs?.[0];
      // edições bilíngues trazem o título em inglês ("The Lusiad of Luis de Camoens")
      if (!edicao?.language?.includes("por") || edicao.language.includes("eng")) return null;
      return {
        titulo: tituloEmPortugues(d, edicao),
        autor: d.author_name?.[0] || "",
        capa: edicao.cover_i || d.cover_i || null,
        obra: d.key.split("/").pop(),
        resposta: ["digital · grátis"],
      };
    })
    .filter((l) => l?.capa && l.autor && l.titulo.length <= 60);
}

export async function vitrine(opcoes = {}) {
  const [indicadas, gratis] = await Promise.allSettled([recentes(24), gratisEmPortugues(opcoes)]);
  const daComunidade = (indicadas.status === "fulfilled" ? indicadas.value : [])
    .filter((f) => f.capa)
    .map((f) => ({ titulo: f.titulo, autor: f.autor, capa: f.capa, obra: f.obra || null, resposta: [`${FORMATO[f.formato]} · ${precoTexto(f.preco)}`], indicado: f.criada }));
  const vistos = new Set();
  return [...daComunidade, ...(gratis.status === "fulfilled" ? gratis.value : [])]
    .filter((l) => {
      const k = normaliza(`${l.titulo} ${l.autor}`);
      return !vistos.has(k) && vistos.add(k);
    })
    .slice(0, QUANTOS);
}
