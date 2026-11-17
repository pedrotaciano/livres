#!/usr/bin/env bun
// sebo na linha de comando: bun cli.js <link do RSS | export.csv> [--json]

import { lerRss, livrosDoCsv } from "./lib/goodreads.js";
import { melhorPreco } from "./lib/estante.js";

const args = process.argv.slice(2);
const json = args.includes("--json");
const entrada = args.find((a) => !a.startsWith("--"));

if (!entrada) {
  console.error("uso: bun cli.js <link do RSS da estante | goodreads_library_export.csv> [--json]");
  process.exit(1);
}

const reais = (centavos) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

try {
  const livros = /^https?:/.test(entrada) ? await lerRss(entrada) : livrosDoCsv(await Bun.file(entrada).text());
  const saida = [];
  for (const [i, livro] of livros.entries()) {
    process.stderr.write(`\r${i + 1}/${livros.length} ${livro.titulo.slice(0, 50).padEnd(50)}`);
    try {
      saida.push({ ...livro, ...(await melhorPreco(livro)) });
    } catch (e) {
      saida.push({ ...livro, erro: e.message });
    }
  }
  process.stderr.write("\r\x1b[2K");

  if (json) {
    console.log(JSON.stringify(saida, null, 2));
  } else {
    for (const l of saida) {
      const preco = l.melhor ? reais(l.melhor.preco).padStart(11) : "          –";
      const onde = l.erro || l.melhor?.url || `nada · ${l.busca}`;
      console.log(`${preco}  ${l.titulo.slice(0, 44).padEnd(44)}  ${l.autor.slice(0, 22).padEnd(22)}  ${onde}`);
    }
    const achados = saida.filter((l) => l.melhor);
    console.log(`\n${achados.length} de ${saida.length} livros · total ${reais(achados.reduce((t, l) => t + l.melhor.preco, 0))} (sem frete)`);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
