// sinco livres. Duas vistas na mesma página: o início (busca, wishlist, indicadas agora) e um livro
// (?titulo=…&autor=…). A busca vai direto à Open Library, que aceita chamadas do navegador; preço,
// grátis e fontes da comunidade vêm de /api. Os caminhos são relativos: o livres roda em
// software.sinco.institute/livres/.

import { livrosDoCsv } from "./lib/goodreads.js";

const raiz = document.documentElement;
const $ = (id) => document.getElementById(id);
const cor = (nome) => getComputedStyle(raiz).getPropertyValue(nome).trim();
const GUARDA = "livres:wishlist";
const PARALELO = 2;
const TIPOS = { gratis: "grátis", biblioteca: "biblioteca", compra: "compra", audio: "audiolivro", outro: "outro" };
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

function linkDoLivro({ titulo, autor, isbn, capa }) {
  const p = new URLSearchParams({ titulo, autor });
  if (isbn?.length) p.set("isbn", isbn.join(","));
  if (capa) p.set("capa", capa);
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

function itemFonte(fonte, livro) {
  if (!fonte.id) {
    // achada pelo livres (Open Library, Estante Virtual)
    return el("li", {}, el("div", { classe: "fonte-linha" }, externo(fonte.url, fonte.fonte), el("span", { classe: "meta" }, fonte.nota)));
  }
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
      await postar("denuncia", { titulo: livro.titulo, autor: livro.autor, id: fonte.id, motivo: denuncia.motivo.value });
      denuncia.replaceWith(el("span", { classe: "meta" }, "Obrigado. Com 3 denúncias o link sai do ar até ser revisado."));
      botao.remove();
    } catch (err) {
      denuncia.replaceWith(el("span", { classe: "meta" }, err.message));
    }
  });
  return el(
    "li",
    {},
    el("div", { classe: "fonte-linha" }, externo(fonte.url, fonte.dominio), fonte.nota && el("span", { classe: "meta" }, fonte.nota)),
    el("div", { classe: "meta" }, `${TIPOS[fonte.tipo]} · indicado por alguém ${haQuanto(fonte.criada)} · `, botao),
    denuncia,
  );
}

function preencherLista(id, itens, vazio) {
  $(id).replaceChildren(...(itens.length ? itens : [el("li", { classe: "vazio" }, vazio)]));
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
  if (/^\d+$/.test(idCapa || "")) capa.src = `https://covers.openlibrary.org/b/id/${idCapa}-M.jpg`;

  const comunidade = { gratis: [], compra: [], outros: [] };
  let gratis = null;
  let preco = null;

  function desenhar() {
    const auto = gratis === null ? [] : gratis.map((f) => itemFonte(f, livro));
    const daComunidade = (lista) => lista.map((f) => itemFonte(f, livro));
    const procurando = gratis === null && comunidade.gratis.length ? [el("li", { classe: "vazio" }, "procurando na Open Library")] : [];
    preencherLista("lista-gratis", [...auto, ...daComunidade(comunidade.gratis), ...procurando], gratis === null ? "procurando" : "Nada grátis por enquanto. Se você conhece um link, indique abaixo.");

    const compra = [];
    if (preco?.melhor) {
      const m = preco.melhor;
      compra.push(
        el(
          "li",
          {},
          el("div", { classe: "fonte-linha" }, externo(m.url, `Estante Virtual · ${reais(m.preco)}`), el("span", { classe: "meta" }, [m.condicao.join("/"), m.idioma, m.ano, m.editora].filter(Boolean).join(" · "))),
          el("div", { classe: "meta" }, `menor preço entre ${preco.anuncios} anúncios, sem frete · `, externo(preco.busca, "ver todos")),
        ),
      );
      if (preco.edicao) compra.push(el("li", {}, el("div", { classe: "fonte-linha" }, externo(preco.edicao.url, `Estante Virtual · esta edição · ${reais(preco.edicao.preco)}`))));
      if (!capa.src && m.capa) capa.src = m.capa;
    } else if (preco) {
      compra.push(el("li", {}, el("div", { classe: "fonte-linha" }, externo(preco.busca, "Estante Virtual"), el("span", { classe: "meta" }, preco.erro || "nenhum anúncio com este título e autor"))));
    }
    preencherLista("lista-compra", [...compra, ...daComunidade(comunidade.compra)], "procurando");

    $("secao-outros").hidden = !comunidade.outros.length;
    preencherLista("lista-outros", daComunidade(comunidade.outros), "");
    $("livro").classList.toggle("sem-capa", !capa.getAttribute("src"));
  }

  function guardarFonte(f) {
    (f.tipo === "gratis" ? comunidade.gratis : f.tipo === "compra" ? comunidade.compra : comunidade.outros).push(f);
  }

  desenhar();
  pedirGratis(livro)
    .then((r) => (gratis = r.fontes))
    .catch(() => (gratis = []))
    .finally(desenhar);
  pedirPreco(livro)
    .then((r) => (preco = r))
    .catch((e) => (preco = { erro: e.message, busca: `https://www.estantevirtual.com.br/busca?q=${encodeURIComponent(`${livro.titulo} ${livro.autor}`)}` }))
    .finally(desenhar);
  api("fontes", { titulo: livro.titulo, autor: livro.autor })
    .then((r) => r.fontes.forEach(guardarFonte))
    .catch(() => {})
    .finally(desenhar);

  const form = $("indicar");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = form.querySelector("button");
    botao.disabled = true;
    try {
      const { fonte } = await postar("fontes", {
        titulo: livro.titulo,
        autor: livro.autor,
        url: form.url.value,
        tipo: form.tipo.value,
        nota: form.nota.value,
        site: form.site.value,
      });
      guardarFonte(fonte);
      desenhar();
      form.url.value = "";
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

async function buscarLivros(q) {
  mostrarAviso("aviso-busca", "procurando");
  $("achados").hidden = true;
  try {
    const u = new URL("https://openlibrary.org/search.json");
    u.searchParams.set("q", q);
    u.searchParams.set("fields", "key,title,author_name,first_publish_year,cover_i,ebook_access");
    u.searchParams.set("limit", "8");
    const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error();
    const { docs } = await r.json();
    const achados = docs.filter((d) => d.title && d.author_name?.length);
    mostrarAviso("aviso-busca", achados.length ? "" : "Nada com esse título ou autor na Open Library.");
    $("achados").replaceChildren(
      ...achados.map((d) => {
        const livro = { titulo: d.title, autor: d.author_name[0], capa: d.cover_i };
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
    mostrarAviso("aviso-busca", "A Open Library não respondeu. Tente de novo em instantes.");
  }
}

// ---------- vista: início · indicadas agora ----------

async function carregarRecentes() {
  try {
    const { fontes } = await api("recentes", {});
    if (!fontes.length) return;
    $("recentes").replaceChildren(
      ...fontes.map((f) =>
        el(
          "li",
          {},
          el("div", { classe: "fonte-linha" }, el("a", { href: linkDoLivro(f) }, f.titulo), el("span", { classe: "meta" }, f.autor)),
          el("div", { classe: "meta" }, `${TIPOS[f.tipo]} · ${f.dominio} · ${haQuanto(f.criada)}`),
        ),
      ),
    );
    $("secao-recentes").hidden = false;
  } catch {
    // sem recentes, a seção fica escondida
  }
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

  $("busca").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("q").value.trim();
    if (q) buscarLivros(q);
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

  carregarRecentes();
}

// ---------- qual vista ----------

const params = new URLSearchParams(location.search);
if (params.get("titulo")) paginaDoLivro(params);
else inicio();
