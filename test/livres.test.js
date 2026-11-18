import { describe, expect, test } from "bun:test";
import { isbn13, livrosDoCsv, livrosDoRss, urlDoRss } from "../lib/goodreads.js";
import { casa, estadoDaPagina } from "../lib/estante.js";
import { lerPreco, validar } from "../lib/fontes.js";
import { chave, CHAVE, sobrenome, tituloPrincipal } from "../lib/texto.js";

describe("texto", () => {
  test("sobrenome: ordem direta, invertida (Gutenberg) e sufixos", () => {
    expect(sobrenome("Gabriel García Márquez")).toBe("marquez");
    expect(sobrenome("Assis, Machado de")).toBe("assis");
    expect(sobrenome("Martin Luther King, Jr.")).toBe("king");
    expect(sobrenome("Paulo Leminski Filho")).toBe("leminski");
  });

  test("chave junta edições do mesmo livro e passa no formato aceito", () => {
    expect(chave("Dom Casmurro", "Machado de Assis")).toBe("dom-casmurro--assis");
    expect(chave("Dom Casmurro: edição comentada", "Assis, Machado de")).toBe("dom-casmurro--assis");
    expect(CHAVE.test(chave("Grande Sertão: Veredas", "João Guimarães Rosa"))).toBe(true);
  });
});

describe("fontes da comunidade", () => {
  const base = { titulo: "Dom Casmurro", autor: "Machado de Assis", formato: "digital", gratis: true, url: "https://pt.wikisource.org/wiki/Dom_Casmurro" };

  test("guarda só o necessário, com domínio e chave calculados no servidor", () => {
    expect(validar({ ...base, nota: "  texto   integral ", chave: "outro--livro", preco: "99", capa: "647501", obra: "OL1003040W" })).toEqual({
      chave: "dom-casmurro--assis",
      titulo: "Dom Casmurro",
      autor: "Machado de Assis",
      url: "https://pt.wikisource.org/wiki/Dom_Casmurro",
      dominio: "pt.wikisource.org",
      formato: "digital",
      preco: 0,
      nota: "texto integral",
      capa: 647501,
      obra: "OL1003040W",
    });
  });

  test("capa e obra que não são da Open Library ficam de fora", () => {
    const f = validar({ ...base, capa: "https://exemplo.com/x.jpg", obra: "../../etc" });
    expect([f.capa, f.obra]).toEqual([null, null]);
  });

  test("preço como as pessoas escrevem: vírgula, ponto, R$, milhar; vazio é não informado", () => {
    expect(lerPreco("28,30")).toBe(2830);
    expect(lerPreco("R$ 1.234,56")).toBe(123456);
    expect(lerPreco("28.30")).toBe(2830);
    expect(lerPreco("1.234")).toBe(123400);
    expect(lerPreco("30")).toBe(3000);
    expect(lerPreco("  ")).toBeNull();
    expect(() => lerPreco("trinta")).toThrow("28,30");
    expect(() => lerPreco("-5")).toThrow("28,30");
    expect(validar({ ...base, gratis: false, formato: "fisico", preco: "" }).preco).toBeNull();
  });

  test("recusa link que não é da web, com senha, formato inventado ou livro sem título", () => {
    expect(() => validar({ ...base, url: "javascript:alert(1)" })).toThrow("endereço da web");
    expect(() => validar({ ...base, url: "data:text/html,oi" })).toThrow("endereço da web");
    expect(() => validar({ ...base, url: "https://localhost/x" })).toThrow("endereço da web");
    expect(() => validar({ ...base, url: "https://eu:senha@exemplo.com/" })).toThrow("usuário e senha");
    expect(() => validar({ ...base, formato: "torrent" })).toThrow("digital ou físico");
    expect(() => validar({ ...base, titulo: "  " })).toThrow("título");
  });
});

describe("goodreads", () => {
  test("ISBN-10 vira ISBN-13 com o dígito certo", () => {
    expect(isbn13("0060916303")).toBe("9780060916305");
    expect(isbn13("080442957X")).toBe("9780804429573");
    expect(isbn13("")).toBeNull();
  });

  test("CSV do export: aspas, quebra de linha na resenha, ISBN em fórmula e só a want-to-read", () => {
    const csv = [
      "Book Id,Title,Author,ISBN,ISBN13,My Review,Exclusive Shelf",
      '1,"Small Is Beautiful: Economics as if People Mattered",E.F. Schumacher,="0060916303",="9780060916305","",to-read',
      '2,"Duna (Crônicas de Duna, #1)",Frank Herbert,="",="","li em 2019,\nreler",read',
      '3,"Tudo, ""entre aspas""",Fulano,="",="",,to-read',
    ].join("\r\n");
    const livros = livrosDoCsv(csv);
    expect(livros.map((l) => l.titulo)).toEqual(["Small Is Beautiful: Economics as if People Mattered", 'Tudo, "entre aspas"']);
    expect(livros[0].isbn).toEqual(["9780060916305"]);
    expect(livros[1].isbn).toEqual([]);
  });

  test("CSV que não é do Goodreads é recusado", () => {
    expect(() => livrosDoCsv("nome,preco\na,1")).toThrow("export do Goodreads");
  });

  test("RSS: CDATA e entidades", () => {
    const xml = `<rss><channel><item><title><![CDATA[Grande Sertão: Veredas]]></title><book_id>123</book_id>
      <author_name>Jo&#227;o Guimar&#xE3;es Rosa</author_name><isbn>8535908846</isbn>
      <book_large_image_url><![CDATA[https://i.gr-assets.com/x.jpg]]></book_large_image_url></item></channel></rss>`;
    expect(livrosDoRss(xml)).toEqual([
      {
        id: "123",
        titulo: "Grande Sertão: Veredas",
        autor: "João Guimarães Rosa",
        isbn: ["9788535908848"],
        capa: "https://i.gr-assets.com/x.jpg",
        url: "https://www.goodreads.com/book/show/123",
      },
    ]);
  });

  test("link do perfil explica onde achar o RSS; o RSS com chave passa", () => {
    expect(() => urlDoRss("https://www.goodreads.com/user/show/183902947-pedro-taciano")).toThrow("link “RSS”");
    expect(() => urlDoRss("https://example.com/review/list_rss/1?key=a")).toThrow("não é do Goodreads");
    const u = urlDoRss("https://www.goodreads.com/review/list_rss/183902947?key=abc&shelf=to-read");
    expect(u.href).toBe("https://www.goodreads.com/review/list_rss/183902947?key=abc&shelf=to-read");
  });
});

describe("estante", () => {
  const anuncio = (nome, autor, isbn = null) => ({ nome, autor, isbn });

  test("título principal sem série nem subtítulo", () => {
    expect(tituloPrincipal("Duna (Crônicas de Duna, #1)")).toBe("duna");
    expect(tituloPrincipal("Small Is Beautiful: Economics as if People Mattered")).toBe("small is beautiful");
  });

  test("aceita a mesma obra, inclusive traduzida com o original entre parênteses", () => {
    const sb = { titulo: "Small Is Beautiful: Economics as if People Mattered", autor: "E.F. Schumacher", isbn: [] };
    expect(casa(sb, anuncio("Small is Beautiful", "E. F. Schumacher"))).toBe("obra");
    expect(casa(sb, anuncio("O Negócio é Ser Pequeno (Small is Beautiful)", "E.F. Schumacher"))).toBe("obra");
    const gsv = { titulo: "Grande Sertão: Veredas", autor: "João Guimarães Rosa", isbn: [] };
    expect(casa(gsv, anuncio("Grande Sertão Veredas", "Guimarães Rosa"))).toBe("obra");
  });

  test("recusa livros que só contêm o título ou são de outro autor", () => {
    const duna = { titulo: "Duna (Crônicas de Duna, #1)", autor: "Frank Herbert", isbn: [] };
    expect(casa(duna, anuncio("O Messias de Duna", "Frank Herbert"))).toBeNull();
    const orwell = { titulo: "1984", autor: "George Orwell", isbn: [] };
    expect(casa(orwell, anuncio("No Sombra de 1984", "George Orwell"))).toBeNull();
    expect(casa(orwell, anuncio("1984", "Fulano de Tal"))).toBeNull();
  });

  test("mesmo ISBN é a mesma edição, qualquer que seja o nome do anúncio", () => {
    const sb = { titulo: "Small Is Beautiful", autor: "E.F. Schumacher", isbn: ["9780060916305"] };
    expect(casa(sb, anuncio("Economia como se as pessoas importassem", "", "9780060916305"))).toBe("edicao");
  });

  test("lê o estado embutido na página de busca", () => {
    const html = `<script>window.__INITIAL_STATE__={"SearchPage":{"empty":false,"parentSkus":[{"name":"a</b>"}]}};</script>`;
    expect(estadoDaPagina(html).SearchPage.parentSkus[0].name).toBe("a</b>");
    expect(estadoDaPagina("<html></html>")).toBeNull();
  });
});
