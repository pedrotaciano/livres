# sebo

Sua estante *want-to-read* do Goodreads com o menor preço da Estante Virtual ao lado de cada livro. Um produto do [sinco software](https://software.sinco.institute/), aberto (MIT), sem dependências: JavaScript puro.

Online em **[software.sinco.institute/sebo](https://software.sinco.institute/sebo/)**.

```bash
bun start        # http://localhost:4192, os mesmos arquivos e funções da versão online
bun test         # leitura do Goodreads e casamento de anúncios
bun cli.js goodreads_library_export.csv          # tabela no terminal
bun cli.js "<link do RSS>" --json > precos.json  # para outro programa
```

## De onde vem a lista

O Goodreads fechou a API em 2020. Sobram duas portas, e o sebo aceita as duas:

- **RSS da estante**: em *My Books → Want to Read*, role até o fim e copie o link *RSS*. Ele traz a chave da conta (`?key=…`), então funciona mesmo com a estante fechada; sem a chave o Goodreads responde 404. A capa vem junto.
- **CSV**: *My Books → Import and export → Export Library*. É lido no próprio navegador (o arquivo traz resenhas e notas privadas e não sai dali); só título, autor e ISBN vão para a busca de preço. Entram os livros com `Exclusive Shelf = to-read`.

O link do RSS passa pelo servidor, porque o Goodreads não aceita chamadas de outra origem; ele é usado para essa leitura e não fica guardado.

## Como o preço é achado

Para cada livro, três buscas na Estante Virtual, uma por vez e com 0,8 s entre elas: título + sobrenome por relevância, o mesmo por menor preço, e o ISBN quando há. Um anúncio vale quando:

- tem o mesmo ISBN do Goodreads (**esta edição**), ou
- o autor do anúncio contém o sobrenome do autor e o nome do anúncio **começa** pelo título (sem série nem subtítulo) ou o traz entre parênteses, como em *O Negócio é Ser Pequeno (Small is Beautiful)*. Só conter o título não basta: *O Messias de Duna* não é *Duna*.

O mais barato que passa é o preço mostrado, em qualquer edição e idioma; quando a mesma edição do Goodreads aparece mais cara, ela vem logo abaixo. O preço é o do anúncio, **sem frete** (depende do CEP e do sebo). Títulos traduzidos com outro nome (*Tools for Conviviality* × *A Convivencialidade*) não casam: o livro aparece como “nada na estante”, com o link da busca.

## Limites

- A Estante Virtual não tem API pública. O sebo lê o JSON que a própria página de busca embute (`window.__INITIAL_STATE__`); se a página mudar, `estadoDaPagina` avisa.
- A Estante fica atrás de um anti-robô (ShieldSquare). O endpoint JSON `/busca/api` cai no desafio rápido; a página de busca, não. Por isso uma busca por vez em cada servidor, o preço guardado 6 h no CDN da Vercel (`GET /api/preco`: o mesmo livro pedido por outra pessoa não vira outra busca) e a lista guardada no navegador, que continua de onde parou. Se o desafio aparecer, o sebo para e avisa.
- Uma wishlist de 100 livros leva uns 4 minutos na primeira vez.

## Publicar

Projeto `sebo` na Vercel (`sebo-amber.vercel.app`), funções em `gru1`, perto da Estante. O site do sinco software repassa `/sebo/` para lá (`vercel.json` dele), por isso todos os caminhos daqui são relativos.

```bash
npx vercel deploy --prod --scope sincos-projects-b8945148
```

`vercel.json` fixa o preset *Other*: com o preset *Node*, que a Vercel escolheu sozinha, a pasta inteira vira uma função e nada abre. Pelo mesmo motivo o script da página é `main.js`, não `app.js`.

## Arquivos

| arquivo | o quê |
| --- | --- |
| `index.html`, `main.js`, `styles.css` | interface no sistema do sinco software: temas (`T` avança, `Shift+T` volta), pílulas, cartões de vidro, Fragment Mono |
| `lib/goodreads.js` | RSS (com páginas), CSV do export, ISBN-10 → 13; roda no servidor e no navegador |
| `lib/estante.js` | busca, leitura do anúncio, casamento livro × anúncio, menor preço |
| `api/estante.js`, `api/preco.js` | as funções da Vercel |
| `server.js` | `Bun.serve` local com as mesmas funções |
| `cli.js` | o mesmo pelo terminal |
| `test/` | `bun test` |
