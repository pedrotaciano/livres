// A fonte grátis que o livres acha sozinho: Open Library (Internet Archive), com leitura aberta
// ("public") ou empréstimo digital grátis com conta ("borrowable").
// O Gutenberg ficou de fora da busca automática: o gutendex.com, a API dele, leva mais de 20 s
// (ou não responde) em buscas que ainda não estão no cache. Links do Gutenberg, do Domínio
// Público e de outros acervos entram pelas fontes da comunidade.

import { mesmaObra, sobrenome, tituloPrincipal } from "./texto.js";

const PRAZO = 8000;
const IDIOMAS = { por: "português", eng: "inglês", spa: "espanhol", fre: "francês", ita: "italiano", ger: "alemão" };

export async function fontesGratis(livro, { fetch = globalThis.fetch } = {}) {
  const u = new URL("https://openlibrary.org/search.json");
  u.searchParams.set("title", tituloPrincipal(livro.titulo));
  u.searchParams.set("author", sobrenome(livro.autor));
  u.searchParams.set("fields", "key,title,author_name,ebook_access,language");
  u.searchParams.set("limit", "10");
  const r = await fetch(u, { signal: AbortSignal.timeout(PRAZO), headers: { "user-agent": "sinco livres (+https://software.sinco.institute/livres/)" } });
  if (!r.ok) throw new Error(`A Open Library respondeu ${r.status}.`);
  const { docs = [] } = await r.json();
  return docs
    .filter((d) => ["public", "borrowable"].includes(d.ebook_access) && mesmaObra(livro, { nome: d.title, autor: (d.author_name || []).join("; ") }))
    .sort((a, b) => (a.ebook_access === "public" ? -1 : 0) - (b.ebook_access === "public" ? -1 : 0))
    .map((d) => ({
      fonte: "Open Library",
      url: `https://openlibrary.org${d.key}`,
      nota: [
        d.ebook_access === "public" ? "leitura aberta" : "empréstimo digital, com conta",
        [...new Set((d.language || []).map((i) => IDIOMAS[i]).filter(Boolean))].join(", "),
      ]
        .filter(Boolean)
        .join(" · "),
    }));
}
