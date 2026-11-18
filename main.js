// sinco livres. Duas vistas na mesma página: o início (busca, wishlist, indicadas agora) e um livro
// (?titulo=…&autor=…). A busca vai direto à Open Library, que aceita chamadas do navegador; preço,
// grátis e fontes da comunidade vêm de /api. Os caminhos são relativos: o livres roda em
// software.sinco.institute/livres/.

import { livrosDoCsv } from "./lib/goodreads.js";
import { mesmaObra } from "./lib/texto.js";

const raiz = document.documentElement;
const $ = (id) => document.getElementById(id);
const cor = (nome) => getComputedStyle(raiz).getPropertyValue(nome).trim();
const GUARDA = "livres:wishlist";
const PARALELO = 2;
const FORMATOS = { digital: "digital", fisico: "físico" };
const MOTIVOS = ["pirataria", "link quebrado", "livro errado", "spam ou golpe", "outro"];

// ---------- tema (os mesmos do sinco software; T avança, Shift+T volta) ----------

const TEMAS = ["tabaco", "cinza", "terra", "musgo", "argila", "chumbo", "noite"];
let avisoTimer;

function aplicarTema(id, mostrar = false) {
  const tema = TEMAS.includes(id) ? id : TEMAS[0];
  raiz.dataset.tema = tema;
  sessionStorage.setItem("livres:tema", tema);
  document.querySelector('meta[name="theme-color"]').content = cor("--fundo");
  if (!mostrar) return;
  const aviso = $("aviso-tema");
  aviso.textContent = `${TEMAS.indexOf(tema) + 1}/${TEMAS.length} · ${tema}`;
  aviso.classList.add("ativo");
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => aviso.classList.remove("ativo"), 1400);
}

const passarTema = (passo) => aplicarTema(TEMAS[(TEMAS.indexOf(raiz.dataset.tema) + passo + TEMAS.length) % TEMAS.length], true);

aplicarTema(sessionStorage.getItem("livres:tema"));
$("botao-tema").addEventListener("click", (e) => passarTema(e.shiftKey ? -1 : 1));
addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key.toLowerCase() === "t") passarTema(e.shiftKey ? -1 : 1);
  if (e.key === "/" && !$("heroi").hidden) {
    e.preventDefault();
    $("q").focus();
  }
});

// ---------- utilidades ----------

const reais = (centavos) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const relativo = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
function haQuanto(iso) {
  const s = (new Date(iso) - Date.now()) / 1000;
  for (const [unidade, tam] of [["day", 86400], ["hour", 3600], ["minute", 60]]) if (Math.abs(s) >= tam) return relativo.format(Math.round(s / tam), unidade);
  return "agora";
}

// Monta elementos sem innerHTML: tudo que vem de fora entra como texto.
function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) if (v != null && v !== false) e.setAttribute(k === "classe" ? "class" : k, v);
  e.append(...filhos.flat().filter((f) => f != null && f !== false && f !== ""));
  return e;
}

const linkSeguro = (url) => (/^https?:\/\//i.test(url) ? url : null);
const externo = (url, ...filhos) => el("a", { href: linkSeguro(url), target: "_blank", rel: "noopener nofollow ugc" }, ...filhos);

function linkDoLivro({ titulo, autor, isbn, capa, obra }) {
  const p = new URLSearchParams({ titulo, autor });
  if (isbn?.length) p.set("isbn", isbn.join(","));
  if (capa) p.set("capa", capa);
  if (obra) p.set("obra", obra);
  return `?${p}`;
}

async function pedir(resposta) {
  const r = await resposta;
  const dados = await r.json().catch(() => ({ erro: `O servidor respondeu ${r.status}.` }));
  if (!r.ok) throw new Error(dados.erro);
  return dados;
}

const api = (nome, params) => pedir(fetch(`api/${nome}?${new URLSearchParams(params)}`));
const postar = (nome, corpo) => pedir(fetch(`api/${nome}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) }));
const pedirPreco = (l) => api("preco", { titulo: l.titulo, autor: l.autor, isbn: (l.isbn || []).join(",") });
const pedirGratis = (l) => api("gratis", { titulo: l.titulo, autor: l.autor });

function mostrarAviso(id, texto) {
  $(id).textContent = texto || "";
  $(id).hidden = !texto;
}

// ---------- uma fonte na lista ----------

// Toda fonte vira { nome, url, meta, preco, formato, comunidade? }: preco 0 é grátis, null é não informado.
const precoTexto = (c) => (c === 0 ? "grátis" : c == null ? "—" : reais(c));
const porPreco = (a, b) => (a.preco ?? Infinity) - (b.preco ?? Infinity);

function itemFonte(f, livro) {
  const extra = [];
  if (f.comunidade) {
    const denuncia = el(
      "form",
      { classe: "denuncia", hidden: "" },
      el("select", { name: "motivo", "aria-label": "Motivo" }, ...MOTIVOS.map((m) => el("option", { value: m }, m))),
      el("button", { classe: "pilula", type: "submit" }, "enviar"),
    );
    const botao = el("button", { classe: "denunciar", type: "button" }, "denunciar");
    botao.addEventListener("click", () => {
      denuncia.hidden = !denuncia.hidden;
    });
    denuncia.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await postar("denuncia", { titulo: livro.titulo, autor: livro.autor, id: f.comunidade.id, motivo: denuncia.motivo.value });
        denuncia.replaceWith(el("span", { classe: "meta" }, "Obrigado. Com 3 denúncias o link sai do ar até ser revisado."));
        botao.remove();
      } catch (err) {
        denuncia.replaceWith(el("span", { classe: "meta" }, err.message));
      }
    });
    extra.push(el("span", { classe: "meta" }, `indicado por alguém ${haQuanto(f.comunidade.criada)} · `, botao), denuncia);
  }
  return el(
    "li",
    { classe: "fonte-item" },
    el("div", { classe: "fonte-info" }, externo(f.url, f.nome), ...f.meta.filter(Boolean).map((m) => el("span", { classe: "meta" }, m)), ...extra),
    el("span", { classe: f.preco === 0 ? "fonte-preco gratis" : "fonte-preco", title: f.preco == null ? "preço não informado" : null }, precoTexto(f.preco)),
  );
}

const daComunidade = (f) => ({ nome: f.dominio, url: f.url, meta: [f.nota], preco: f.preco, formato: f.formato, comunidade: f });

function preencherLista(id, itens, vazio) {
  $(id).replaceChildren(...(itens.length ? itens : [el("li", { classe: "vazio" }, vazio)]));
}

// ---------- vista: um livro · perfil (Open Library) ----------

const IDIOMAS = { por: "português", eng: "inglês", spa: "espanhol", fre: "francês", ita: "italiano", ger: "alemão" };
// marcas de acervo da Open Library que não dizem nada sobre o livro
const ASSUNTO_RUIDO = /accessible book|protected daisy|in library|lending library|overdrive|large type|nyt:|open library|reading level|^\d/i;

function limparSinopse(d) {
  const s = typeof d === "string" ? d : d?.value || "";
  return s
    .split(/\r?\n\s*-{3,}|\r?\n\s*\*{0,2}contains|\(\[source\]/i)[0]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/(\*{1,2}|_{1,2})(\S[^*_]*?\S|\S)\1/g, "$2")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

async function perfilNaOpenLibrary(livro, obra) {
  const u = new URL("https://openlibrary.org/search.json");
  u.searchParams.set("title", livro.titulo);
  u.searchParams.set("author", livro.autor);
  u.searchParams.set("fields", "key,title,author_name,first_publish_year,number_of_pages_median,edition_count,ratings_average,ratings_count,language,subject,cover_i");
  u.searchParams.set("limit", "10");
  const { docs = [] } = await (await fetch(u, { signal: AbortSignal.timeout(12000) })).json();
  const doc = docs.find((d) => d.key === `/works/${obra}`) || docs.find((d) => mesmaObra(livro, { nome: d.title, autor: (d.author_name || []).join("; ") }));
  if (!doc) return null;
  const obraJson = await fetch(`https://openlibrary.org${doc.key}.json`, { signal: AbortSignal.timeout(12000) })
    .then((r) => r.json())
    .catch(() => ({}));
  return { ...doc, sinopse: limparSinopse(obraJson.description), assuntos: obraJson.subjects || doc.subject || [] };
}

function mostrarPerfil(p, capa) {
  if (p.ratings_count) {
    const media = p.ratings_average.toFixed(1).replace(".", ",");
    $("livro-nota").textContent = `★ ${media} · ${p.ratings_count === 1 ? "1 avaliação" : `${p.ratings_count} avaliações`} na Open Library`;
    $("livro-nota").hidden = false;
  }
  if (p.sinopse) {
    const caixa = $("livro-sinopse");
    caixa.querySelector("p").textContent = p.sinopse;
    caixa.hidden = false;
    const mais = caixa.querySelector("button");
    const texto = caixa.querySelector("p");
    mais.hidden = texto.scrollHeight <= texto.clientHeight + 2;
    mais.onclick = () => {
      caixa.classList.toggle("aberta");
      mais.textContent = caixa.classList.contains("aberta") ? "menos" : "mais";
    };
  }
  const idiomas = [...new Set((p.language || []).map((i) => IDIOMAS[i]).filter(Boolean))].join(", ");
  const detalhes = [
    p.first_publish_year && `primeira edição em ${p.first_publish_year}`,
    p.number_of_pages_median && `${p.number_of_pages_median} páginas`,
    p.edition_count && (p.edition_count === 1 ? "1 edição" : `${p.edition_count} edições`),
    idiomas,
  ].filter(Boolean);
  if (detalhes.length) {
    $("livro-detalhes").textContent = detalhes.join(" · ");
    $("livro-detalhes").hidden = false;
  }
  const assuntos = [...new Set(p.assuntos.filter((a) => a.length < 40 && !ASSUNTO_RUIDO.test(a)))].slice(0, 6);
  if (assuntos.length) {
    $("livro-assuntos").replaceChildren(...assuntos.map((a) => el("li", { classe: "tag" }, a.toLowerCase())));
    $("livro-assuntos").hidden = false;
  }
  $("livro-origem").replaceChildren("Dados e sinopse: ", externo(`https://openlibrary.org${p.key}`, "Open Library ↗"));
  $("livro-origem").hidden = false;
  if (!capa.getAttribute("src") && p.cover_i) capa.src = `https://covers.openlibrary.org/b/id/${p.cover_i}-L.jpg`;
}

// ---------- vista: um livro ----------

async function paginaDoLivro(params) {
  const livro = {
    titulo: params.get("titulo"),
    autor: params.get("autor") || "",
    isbn: (params.get("isbn") || "").split(",").filter(Boolean),
  };
  document.title = `${livro.titulo} · livres`;
  $("livro").hidden = false;
  $("livro-titulo").textContent = livro.titulo;
  $("livro-autor").textContent = livro.autor;
  const capa = $("livro-capa");
  const idCapa = params.get("capa");
  if (/^\d+$/.test(idCapa || "")) capa.src = `https://covers.openlibrary.org/b/id/${idCapa}-L.jpg`;
  // capa e obra da Open Library: vão junto com cada indicação, para a estante viva do início
  const openLibrary = { capa: /^\d+$/.test(idCapa || "") ? idCapa : null, obra: params.get("obra") };

  let gratis = null; // Open Library
  let estante = null; // Estante Virtual
  const comunidade = [];

  function desenhar() {
    const fontes = [...(gratis || []), ...(estante || []), ...comunidade.map(daComunidade)];
    const pendente = { digital: gratis === null, fisico: estante === null };
    const atalhos = [];
    for (const formato of ["digital", "fisico"]) {
      const itens = fontes.filter((f) => f.formato === formato).sort(porPreco);
      const linhas = itens.map((f) => itemFonte(f, livro));
      if (pendente[formato] && itens.length) linhas.push(el("li", { classe: "vazio" }, "procurando mais"));
      preencherLista(`lista-${formato}`, linhas, pendente[formato] ? "procurando" : "Nada por enquanto. Conhece um link? Indique abaixo.");
      const menor = itens.find((f) => f.preco != null);
      if (menor) atalhos.push(el("a", { classe: "pilula", href: "#onde" }, `${FORMATOS[formato]} · ${precoTexto(menor.preco)}`));
    }
    $("atalhos").replaceChildren(...atalhos);
    $("livro").classList.toggle("sem-capa", !capa.getAttribute("src"));
  }

  desenhar();
  perfilNaOpenLibrary(livro, params.get("obra"))
    .then((p) => {
      if (!p) return;
      mostrarPerfil(p, capa);
      openLibrary.capa ||= p.cover_i || null;
      openLibrary.obra ||= p.key.split("/").pop();
    })
    .catch(() => {})
    .finally(desenhar);
  pedirGratis(livro)
    .then((r) => (gratis = r.fontes.map((f) => ({ nome: f.fonte, url: f.url, meta: [f.nota], preco: 0, formato: "digital" }))))
    .catch(() => (gratis = []))
    .finally(desenhar);
  pedirPreco(livro)
    .then((r) => {
      if (!r.melhor) return (estante = [{ nome: "Estante Virtual", url: r.busca, meta: ["nenhum anúncio com este título e autor"], preco: null, formato: "fisico" }]);
      const m = r.melhor;
      estante = [
        {
          nome: "Estante Virtual",
          url: m.url,
          meta: [[m.condicao.join("/"), m.idioma, m.ano, m.editora].filter(Boolean).join(" · "), [`menor preço entre ${r.anuncios} anúncios, sem frete · `, externo(r.busca, "ver todos")]],
          preco: m.preco,
          formato: "fisico",
        },
      ];
      if (r.edicao) estante.push({ nome: "Estante Virtual · esta edição", url: r.edicao.url, meta: [[r.edicao.idioma, r.edicao.ano, r.edicao.editora].filter(Boolean).join(" · ")], preco: r.edicao.preco, formato: "fisico" });
      if (!capa.getAttribute("src") && m.capa) capa.src = m.capa;
    })
    .catch((e) => (estante = [{ nome: "Estante Virtual", url: `https://www.estantevirtual.com.br/busca?q=${encodeURIComponent(`${livro.titulo} ${livro.autor}`)}`, meta: [e.message], preco: null, formato: "fisico" }]))
    .finally(desenhar);
  api("fontes", { titulo: livro.titulo, autor: livro.autor })
    .then((r) => comunidade.push(...r.fontes))
    .catch(() => {})
    .finally(desenhar);

  const form = $("indicar");
  form.gratis.addEventListener("change", () => {
    form.preco.disabled = form.gratis.checked;
    if (form.gratis.checked) form.preco.value = "";
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = form.querySelector('button[type="submit"]');
    botao.disabled = true;
    try {
      const { fonte } = await postar("fontes", {
        titulo: livro.titulo,
        autor: livro.autor,
        url: form.url.value,
        formato: form.formato.value,
        preco: form.preco.value,
        gratis: form.gratis.checked,
        nota: form.nota.value,
        capa: openLibrary.capa,
        obra: openLibrary.obra,
        site: form.site.value,
      });
      comunidade.push(fonte);
      desenhar();
      form.url.value = "";
      form.preco.value = "";
      form.nota.value = "";
      mostrarAviso("aviso-indicar", "Obrigado: o link já está na página.");
    } catch (err) {
      mostrarAviso("aviso-indicar", err.message);
    } finally {
      botao.disabled = false;
    }
  });
}

// ---------- vista: início · busca ----------

let ultimaBusca = "";

async function buscarLivros(q) {
  ultimaBusca = q;
  pararDeGirar();
  mostrarAviso("aviso-busca", "procurando na Open Library");
  const demorou = setTimeout(() => q === ultimaBusca && mostrarAviso("aviso-busca", "ainda procurando na Open Library…"), 2000);
  $("achados").hidden = true;
  try {
    const u = new URL("https://openlibrary.org/search.json");
    u.searchParams.set("q", q);
    u.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i,ebook_access");
    u.searchParams.set("limit", "8");
    const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error();
    const { docs } = await r.json();
    if (q !== ultimaBusca) return;
    const achados = docs.filter((d) => d.title && d.author_name?.length);
    mostrarAviso("aviso-busca", achados.length ? "" : `Nada com “${q}” na Open Library.`);
    $("achados").replaceChildren(
      ...achados.map((d) => {
        const livro = { titulo: d.title, autor: d.author_name[0], capa: d.cover_i, obra: d.key.split("/").pop() };
        const gratis = ["public", "borrowable"].includes(d.ebook_access);
        return el(
          "li",
          {},
          el(
            "a",
            { href: linkDoLivro(livro) },
            el("span", { classe: "capa" }, d.cover_i && el("img", { src: `https://covers.openlibrary.org/b/id/${d.cover_i}-S.jpg`, alt: "", loading: "lazy" })),
            el("span", { classe: "obra" }, el("span", { classe: "titulo" }, d.title), el("span", { classe: "autor" }, [d.author_name[0], d.first_publish_year].filter(Boolean).join(" · "))),
            gratis && el("span", { classe: "tag" }, "grátis"),
          ),
        );
      }),
    );
    $("achados").hidden = !achados.length;
  } catch {
    if (q !== ultimaBusca) return;
    const tentar = el("button", { classe: "denunciar", type: "button" }, "tentar de novo");
    tentar.addEventListener("click", () => buscarLivros(q));
    $("aviso-busca").replaceChildren("A Open Library não respondeu. ", tentar);
    $("aviso-busca").hidden = false;
  } finally {
    clearTimeout(demorou);
  }
}

// ---------- vista: início · a estante viva ----------
// Atrás do "quero ler ___", as capas dos livros indicados há pouco e dos que dá para ler de graça,
// desfocadas: passar o mouse traz um para o foco. A lacuna mostra um deles por vez, com a resposta
// do livres embaixo; para de girar quando a pessoa clica ou escreve.

const CAPAS_NO_CAMPO = 84; // o bastante para encher 1440×900; os livros se repetem
const reduzMovimento = matchMedia("(prefers-reduced-motion: reduce)");
let vitrine = [];
let giro = null;
let vez = 0;

function desenharCampo() {
  const n = vitrine.length;
  $("campo").replaceChildren(
    ...Array.from({ length: CAPAS_NO_CAMPO }, (_, i) => {
      if (!n) return el("span", { classe: "vaga" });
      // passo 7: a mesma ordem a cada visita, sem o mesmo livro lado a lado
      const l = vitrine[(i * 7) % n];
      return el(
        "a",
        { href: linkDoLivro(l), tabindex: "-1" },
        el("img", { src: `https://covers.openlibrary.org/b/id/${l.capa}-M.jpg`, alt: "" }),
        el("span", { classe: "rotulo" }, l.titulo, el("br"), l.resposta.join(" · ")),
      );
    }),
  );
}

// Na lacuna só entram títulos que cabem numa linha da frase grande; o campo mostra todos.
const CABE_NA_LACUNA = 28;
const naLacuna = () => vitrine.filter((l) => l.titulo.length <= CABE_NA_LACUNA);
const livroDaVez = () => naLacuna()[vez % naLacuna().length];

function mostrarVez() {
  const l = livroDaVez();
  $("q").placeholder = l.titulo;
  $("resposta").replaceChildren(...[...l.resposta, l.autor].map((r) => el("a", { classe: "pilula", href: linkDoLivro(l) }, r)));
}

function girar() {
  if (!naLacuna().length) return;
  mostrarVez();
  if (reduzMovimento.matches) return;
  giro = setInterval(() => {
    $("heroi").classList.add("trocando");
    setTimeout(() => {
      vez++;
      mostrarVez();
      $("heroi").classList.remove("trocando");
    }, 280);
  }, 3200);
}

function pararDeGirar() {
  clearInterval(giro);
  giro = null;
  $("heroi").classList.remove("trocando");
}

async function carregarVitrine() {
  desenharCampo(); // vagas vazias enquanto carrega: o campo não pula quando as capas chegam
  try {
    vitrine = (await api("vitrine", {})).livros;
  } catch {
    vitrine = [];
  }
  desenharCampo();
  if (!$("q").value && !ultimaBusca) girar();
}

// ---------- vista: início · wishlist ----------

let livros = [];
let resultados = {}; // id → { estado: "ok" | "nada" | "erro", preco, gratis }
let ordem = "wishlist";
let rodada = 0; // uma lista nova cancela a fila da anterior
const linhas = new Map();

const guardar = () => localStorage.setItem(GUARDA, JSON.stringify({ rss: $("rss").value, livros, resultados }));

function preencherLinha(li, livro) {
  const r = resultados[livro.id];
  li.dataset.estado = r ? r.estado : "buscando";
  const img = li.querySelector("img");
  const capa = livro.capa || r?.preco?.melhor?.capa;
  if (capa && img.getAttribute("src") !== capa) img.src = capa;

  const titulo = li.querySelector(".titulo");
  titulo.textContent = livro.titulo;
  titulo.href = linkDoLivro(livro);
  li.querySelector(".autor").textContent = livro.autor;

  const valor = li.querySelector(".valor");
  const meta = li.querySelector(".meta");
  const tag = li.querySelector(".tag");
  tag.hidden = !r?.gratis;
  tag.href = linkDoLivro(livro);
  const p = r?.preco;
  if (!r) {
    valor.textContent = "buscando";
    valor.removeAttribute("href");
    meta.textContent = "";
  } else if (p?.melhor) {
    const m = p.melhor;
    valor.textContent = reais(m.preco);
    valor.href = m.url;
    valor.title = m.nome;
    const anuncios = p.anuncios === 1 ? "1 anúncio" : `${p.anuncios} anúncios`;
    const edicao = p.edicao ? `\nesta edição ${reais(p.edicao.preco)}` : m.tipo === "edicao" ? "\nesta edição" : "";
    meta.textContent = [m.condicao.join("/"), m.idioma, m.ano, anuncios].filter(Boolean).join(" · ") + edicao;
  } else {
    valor.textContent = r.estado === "erro" ? "erro · buscar ↗" : "nada na estante ↗";
    valor.href = p?.busca || `https://www.estantevirtual.com.br/busca?q=${encodeURIComponent(livro.titulo)}`;
    meta.textContent = r.estado === "erro" ? r.erro : "";
  }
}

function desenharWishlist() {
  const lista = $("livros");
  const preco = (l) => resultados[l.id]?.preco?.melhor?.preco ?? Infinity;
  const ordenados = ordem === "preco" ? [...livros].sort((a, b) => preco(a) - preco(b)) : livros;
  for (const livro of ordenados) {
    let li = linhas.get(livro.id);
    if (!li) {
      li = $("modelo-livro").content.firstElementChild.cloneNode(true);
      linhas.set(livro.id, li);
    }
    preencherLinha(li, livro);
    lista.append(li); // append move: a ordem do DOM segue a lista
  }

  const prontos = livros.filter((l) => resultados[l.id]);
  const achados = livros.filter((l) => resultados[l.id]?.preco?.melhor);
  const gratis = livros.filter((l) => resultados[l.id]?.gratis).length;
  const soma = achados.reduce((t, l) => t + resultados[l.id].preco.melhor.preco, 0);
  $("resultado").hidden = !livros.length;
  $("contagem").textContent = livros.length === 1 ? "1 livro" : `${livros.length} livros`;
  const total = $("total");
  total.hidden = !livros.length;
  total.textContent =
    prontos.length < livros.length
      ? `buscando ${prontos.length}/${livros.length}`
      : `${reais(soma)} · ${achados.length} de ${livros.length}${gratis ? ` · ${gratis} grátis` : ""}`;
  total.title = "Soma do menor preço de cada livro encontrado, sem frete; e quantos dá para ler de graça";
}

for (const botao of document.querySelectorAll("[data-ordem]")) {
  botao.addEventListener("click", () => {
    ordem = botao.dataset.ordem;
    for (const b of document.querySelectorAll("[data-ordem]")) b.setAttribute("aria-pressed", b === botao);
    desenharWishlist();
  });
}

async function buscarWishlist() {
  const minha = ++rodada;
  const fila = livros.filter((l) => !resultados[l.id] || resultados[l.id].estado === "erro");
  for (const l of fila) delete resultados[l.id];
  desenharWishlist();

  const trabalhar = async () => {
    while (fila.length && minha === rodada) {
      const livro = fila.shift();
      const [preco, gratis] = await Promise.allSettled([pedirPreco(livro), pedirGratis(livro)]);
      if (minha !== rodada) return;
      const nGratis = gratis.status === "fulfilled" ? gratis.value.fontes.length : 0;
      if (preco.status === "fulfilled") {
        resultados[livro.id] = { estado: preco.value.melhor ? "ok" : "nada", preco: preco.value, gratis: nGratis };
      } else {
        // anti-robô da Estante: parar tudo em vez de insistir
        if (/anti-robô/.test(preco.reason.message)) {
          fila.length = 0;
          mostrarAviso("aviso", `${preco.reason.message} Os livros que faltam continuam ao recarregar a página.`);
          desenharWishlist();
          return;
        }
        resultados[livro.id] = { estado: "erro", erro: preco.reason.message, gratis: nGratis };
      }
      guardar();
      desenharWishlist();
    }
  };
  await Promise.all(Array.from({ length: PARALELO }, trabalhar));
}

async function carregarWishlist(lerLivros) {
  mostrarAviso("aviso", "");
  try {
    const lidos = await lerLivros();
    if (!lidos.length) throw new Error("Nenhum livro na estante want-to-read.");
    rodada++;
    livros = lidos.map((l, i) => ({ ...l, id: l.id || `livro-${i}` }));
    resultados = {};
    linhas.clear();
    $("livros").replaceChildren();
    guardar();
    buscarWishlist();
  } catch (e) {
    mostrarAviso("aviso", e.message);
  }
}

function inicio() {
  $("inicio").hidden = false;
  $("heroi").hidden = false;

  // ↵ com a lacuna vazia abre o livro que ela está mostrando
  $("busca").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("q").value.trim();
    if (q) buscarLivros(q);
    else if (naLacuna().length) location.href = linkDoLivro(livroDaVez());
  });
  $("q").addEventListener("focus", pararDeGirar);
  $("q").addEventListener("input", () => {
    pararDeGirar();
    // as pílulas falam do livro da lacuna; escrevendo, somem sem a dica pular de lugar
    $("resposta").style.visibility = $("q").value ? "hidden" : "";
  });

  $("entrada").addEventListener("submit", (e) => {
    e.preventDefault();
    const rss = $("rss").value.trim();
    if (!rss) return $("rss").focus();
    carregarWishlist(async () => (await postar("estante", { rss })).livros);
  });

  $("csv").addEventListener("change", async (e) => {
    const arquivo = e.target.files[0];
    if (arquivo) carregarWishlist(async () => livrosDoCsv(await arquivo.text()));
    e.target.value = "";
  });

  try {
    const ultima = JSON.parse(localStorage.getItem(GUARDA));
    if (ultima?.livros?.length) {
      $("rss").value = ultima.rss || "";
      livros = ultima.livros;
      resultados = ultima.resultados || {};
      buscarWishlist(); // desenha e retoma os que faltam
    }
  } catch {
    localStorage.removeItem(GUARDA);
  }

  // ?q=… : busca compartilhada, ou o formulário enviado antes do script carregar
  const q = new URLSearchParams(location.search).get("q")?.trim();
  if (q) {
    $("q").value = q;
    buscarLivros(q);
  }

  carregarVitrine();
}

// ---------- qual vista ----------

const params = new URLSearchParams(location.search);
if (params.get("titulo")) paginaDoLivro(params);
else inicio();
