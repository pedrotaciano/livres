// sebo: a lista vem do Goodreads — o CSV lido aqui mesmo, o RSS pelo servidor —; cada livro pede
// seu preço e aparece assim que chega. A última busca fica guardada no navegador e continua de onde
// parou. Os caminhos são relativos: o sebo também roda em software.sinco.institute/sebo/.

import { livrosDoCsv } from "./lib/goodreads.js";

const raiz = document.documentElement;
const $ = (id) => document.getElementById(id);
const cor = (nome) => getComputedStyle(raiz).getPropertyValue(nome).trim();
const GUARDA = "sebo:ultima";
const PARALELO = 2;

// ---------- tema (os mesmos do sinco software; T avança, Shift+T volta) ----------

const TEMAS = ["tabaco", "cinza", "terra", "musgo", "argila", "chumbo", "noite"];
let avisoTimer;

function aplicarTema(id, mostrar = false) {
  const tema = TEMAS.includes(id) ? id : TEMAS[0];
  raiz.dataset.tema = tema;
  sessionStorage.setItem("sebo:tema", tema);
  document.querySelector('meta[name="theme-color"]').content = cor("--fundo");
  if (!mostrar) return;
  const aviso = $("aviso-tema");
  aviso.textContent = `${TEMAS.indexOf(tema) + 1}/${TEMAS.length} · ${tema}`;
  aviso.classList.add("ativo");
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => aviso.classList.remove("ativo"), 1400);
}

const passarTema = (passo) => aplicarTema(TEMAS[(TEMAS.indexOf(raiz.dataset.tema) + passo + TEMAS.length) % TEMAS.length], true);

aplicarTema(sessionStorage.getItem("sebo:tema"));
$("botao-tema").addEventListener("click", (e) => passarTema(e.shiftKey ? -1 : 1));
addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea") || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key.toLowerCase() === "t") passarTema(e.shiftKey ? -1 : 1);
});

// ---------- estado ----------

const reais = (centavos) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

let livros = [];
let precos = {}; // id → { estado: "ok" | "nada" | "erro", ... }
let ordem = "wishlist";
let rodada = 0; // uma busca nova cancela a fila da anterior
const linhas = new Map();

const guardar = () => localStorage.setItem(GUARDA, JSON.stringify({ rss: $("rss").value, livros, precos }));

function mostrarAviso(texto) {
  $("aviso").textContent = texto || "";
  $("aviso").hidden = !texto;
}

// ---------- lista ----------

function preencher(li, livro) {
  const p = precos[livro.id];
  li.dataset.estado = p ? p.estado : "buscando";
  const img = li.querySelector("img");
  const capa = p?.melhor?.capa || livro.capa;
  if (capa && img.getAttribute("src") !== capa) img.src = capa;

  const titulo = li.querySelector(".titulo");
  titulo.textContent = livro.titulo;
  if (livro.url) titulo.href = livro.url;
  li.querySelector(".autor").textContent = livro.autor;

  const valor = li.querySelector(".valor");
  const meta = li.querySelector(".meta");
  if (!p) {
    valor.textContent = "buscando";
    valor.removeAttribute("href");
    meta.textContent = "";
  } else if (p.estado === "ok") {
    const m = p.melhor;
    valor.textContent = reais(m.preco);
    valor.href = m.url;
    valor.title = m.nome;
    const anuncios = p.anuncios === 1 ? "1 anúncio" : `${p.anuncios} anúncios`;
    const edicao = p.edicao ? `\nesta edição ${reais(p.edicao.preco)}` : m.tipo === "edicao" ? "\nesta edição" : "";
    meta.textContent = [m.condicao.join("/"), m.idioma, m.ano, anuncios].filter(Boolean).join(" · ") + edicao;
  } else {
    valor.textContent = p.estado === "nada" ? "nada na estante ↗" : "erro · buscar ↗";
    valor.href = p.busca;
    meta.textContent = p.estado === "erro" ? p.erro : "";
  }
}

function desenhar() {
  const lista = $("livros");
  const ordenados =
    ordem === "preco"
      ? [...livros].sort((a, b) => (precos[a.id]?.melhor?.preco ?? Infinity) - (precos[b.id]?.melhor?.preco ?? Infinity))
      : livros;
  for (const livro of ordenados) {
    let li = linhas.get(livro.id);
    if (!li) {
      li = $("modelo-livro").content.firstElementChild.cloneNode(true);
      linhas.set(livro.id, li);
    }
    preencher(li, livro);
    lista.append(li); // append move: a ordem do DOM segue a lista
  }

  const prontos = livros.filter((l) => precos[l.id]);
  const achados = livros.filter((l) => precos[l.id]?.estado === "ok");
  const soma = achados.reduce((t, l) => t + precos[l.id].melhor.preco, 0);
  $("resultado").hidden = !livros.length;
  $("contagem").textContent = livros.length === 1 ? "1 livro" : `${livros.length} livros`;
  const total = $("total");
  total.hidden = !livros.length;
  total.textContent =
    prontos.length < livros.length
      ? `buscando ${prontos.length}/${livros.length}`
      : `${reais(soma)} · ${achados.length} de ${livros.length}`;
  total.title = "Soma do menor preço de cada livro encontrado, sem frete";
}

for (const botao of document.querySelectorAll("[data-ordem]")) {
  botao.addEventListener("click", () => {
    ordem = botao.dataset.ordem;
    for (const b of document.querySelectorAll("[data-ordem]")) b.setAttribute("aria-pressed", b === botao);
    desenhar();
  });
}

// ---------- servidor ----------

async function pedir(r) {
  const dados = await r.json().catch(() => ({ erro: `O servidor respondeu ${r.status}.` }));
  if (!r.ok) throw new Error(dados.erro);
  return dados;
}

const pedirPreco = (livro) =>
  pedir(fetch(`api/preco?${new URLSearchParams({ titulo: livro.titulo, autor: livro.autor, isbn: livro.isbn.join(",") })}`));

const pedirEstante = async (rss) =>
  (await pedir(fetch("api/estante", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rss }) }))).livros;

async function buscarPrecos() {
  const minha = ++rodada;
  const fila = livros.filter((l) => !precos[l.id] || precos[l.id].estado === "erro");
  for (const l of fila) delete precos[l.id];
  desenhar();

  const trabalhar = async () => {
    while (fila.length && minha === rodada) {
      const livro = fila.shift();
      try {
        const r = await pedirPreco(livro);
        if (minha !== rodada) return;
        precos[livro.id] = { estado: r.melhor ? "ok" : "nada", ...r };
      } catch (e) {
        if (minha !== rodada) return;
        // anti-robô da Estante: parar tudo em vez de insistir
        if (/anti-robô/.test(e.message)) {
          fila.length = 0;
          mostrarAviso(`${e.message} Os livros que faltam continuam ao recarregar a página.`);
          desenhar();
          return;
        }
        precos[livro.id] = { estado: "erro", erro: e.message, busca: `https://www.estantevirtual.com.br/busca?q=${encodeURIComponent(livro.titulo)}` };
      }
      guardar();
      desenhar();
    }
  };
  await Promise.all(Array.from({ length: PARALELO }, trabalhar));
}

async function carregar(lerLivros) {
  mostrarAviso("");
  const botoes = document.querySelectorAll(".entrada button, .arquivo");
  for (const b of botoes) b.setAttribute("aria-busy", "true");
  try {
    const lidos = await lerLivros();
    if (!lidos.length) throw new Error("Nenhum livro na estante want-to-read.");
    rodada++;
    livros = lidos.map((l, i) => ({ ...l, id: l.id || `livro-${i}` }));
    precos = {};
    linhas.clear();
    $("livros").replaceChildren();
    guardar();
    buscarPrecos();
  } catch (e) {
    mostrarAviso(e.message);
  } finally {
    for (const b of botoes) b.removeAttribute("aria-busy");
  }
}

$("entrada").addEventListener("submit", (e) => {
  e.preventDefault();
  const rss = $("rss").value.trim();
  if (rss) carregar(() => pedirEstante(rss));
  else $("rss").focus();
});

$("csv").addEventListener("change", async (e) => {
  const arquivo = e.target.files[0];
  if (arquivo) carregar(async () => livrosDoCsv(await arquivo.text()));
  e.target.value = "";
});

// ---------- a última busca ----------

try {
  const ultima = JSON.parse(localStorage.getItem(GUARDA));
  if (ultima?.livros?.length) {
    $("rss").value = ultima.rss || "";
    livros = ultima.livros;
    precos = ultima.precos || {};
    buscarPrecos(); // desenha e retoma os que faltam
  }
} catch {
  localStorage.removeItem(GUARDA);
}
