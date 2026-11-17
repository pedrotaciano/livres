// Como o livres reconhece um livro em fontes diferentes: título principal + sobrenome do autor.
// Roda no servidor e no navegador.

export const normaliza = (s = "") =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// "Duna (Crônicas de Duna, #1)" → "duna"; "Small Is Beautiful: Economics…" → "small is beautiful"
export const tituloPrincipal = (titulo = "") => normaliza(titulo.replace(/\s*\([^)]*#[^)]*\)\s*$/, "").split(/[:;]/)[0]);

// O sobrenome decide: "E.F. Schumacher" → "schumacher"; "Gabriel García Márquez" → "marquez".
// O Gutenberg escreve "Assis, Machado de": o sobrenome vem antes da vírgula. Jr., Filho e Neto
// não contam: "Martin Luther King, Jr." → "king".
const SUFIXOS = new Set(["jr", "junior", "filho", "neto", "sobrinho"]);
export const sobrenome = (autor = "") => {
  const [antes, depois] = autor.split(",");
  const invertido = depois !== undefined && !SUFIXOS.has(normaliza(depois));
  const partes = normaliza(invertido ? antes : autor).split(" ").filter((p) => !SUFIXOS.has(p));
  return partes.pop() || "";
};

// A chave do livro nas fontes da comunidade: "dom-casmurro--assis". Traduções com outro título
// são outro livro, de propósito: o link de uma edição em inglês não serve a quem procura a tradução.
export const chave = (titulo, autor) => `${tituloPrincipal(titulo).replace(/ /g, "-")}--${sobrenome(autor)}`.slice(0, 120);

export const CHAVE = /^[a-z0-9]+(-[a-z0-9]+)*--[a-z0-9]*$/;

const contem = (texto, trecho) => trecho && ` ${texto} `.includes(` ${trecho} `);

// O nome tem de começar pelo título (ou ter o título entre parênteses, como em
// "O Negócio é Ser Pequeno (Small is Beautiful)"). Só conter não basta: "O Messias de Duna" e
// "No Sombra de 1984" contêm "duna" e "1984", e a Estante atribui o segundo ao Orwell.
function tituloBate(nome, titulo) {
  const partes = [nome, ...(nome.match(/\(([^)]+)\)/g) || [])].map((p) => normaliza(p).replace(/^livro /, ""));
  return partes.some((p) => p === titulo || p.startsWith(titulo + " "));
}

// Mesmo título e mesmo autor, em qualquer edição. `outro.autor` pode vir vazio: aí o sobrenome
// tem de estar no próprio nome.
export function mesmaObra(livro, outro) {
  const sob = sobrenome(livro.autor);
  const autorBate = contem(normaliza(outro.autor), sob) || (!outro.autor && contem(normaliza(outro.nome), sob));
  return Boolean(autorBate && tituloBate(outro.nome, tituloPrincipal(livro.titulo)));
}
