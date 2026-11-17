# sinco livres

Onde ler cada livro: de graça, na biblioteca ou no sebo mais barato. Um produto do [sinco software](https://software.sinco.institute/), aberto (MIT).

Online em **[software.sinco.institute/livres](https://software.sinco.institute/livres/)**.

- **Busca** de qualquer livro pelo catálogo da Open Library.
- **Página do livro** no jeito do Goodreads: capa, autor, nota, sinopse, edições, páginas e assuntos (da Open Library), e **onde ler** em duas listas, *digital* e *físico*. Cada fonte mostra o preço ou "grátis", da mais barata para a mais cara; ao lado da capa, o menor preço de cada formato.
- **Fontes da comunidade**: qualquer pessoa indica um link para um livro, sem conta. O livres é um índice: não hospeda arquivo nenhum.
- **Wishlist** do Goodreads (RSS ou CSV) com o menor preço e o que dá para ler de graça, livro a livro. Era o *sebo*, a primeira versão.

```bash
bun install
npx vercel env pull   # token do Blob em .env.local (as fontes da comunidade)
bun start             # http://localhost:4192, os mesmos arquivos e funções da versão online
bun test
bun cli.js goodreads_library_export.csv          # preços da wishlist no terminal
bun moderar.js                                   # denúncias (ver "Moderação")
```

## De onde vem cada coisa

| lista | fonte | como |
| --- | --- | --- |
| busca, perfil do livro | Open Library | direto do navegador (`search.json` e `/works/…json` aceitam CORS) |
| digital | Open Library | `ebook_access` *public* (leitura aberta) ou *borrowable* (empréstimo digital grátis com conta), as duas grátis; cache de 24 h |
| físico | Estante Virtual | o JSON embutido na página de busca; três buscas por livro; cache de 6 h |
| tudo | comunidade | `fontes/<chave>/<id>.json` no Vercel Blob |

Um livro é reconhecido em todas as fontes pelo título principal (sem subtítulo nem série) e pelo sobrenome do autor: `dom-casmurro--assis`. Um anúncio ou um acervo só conta se o nome **começa** pelo título (ou o traz entre parênteses) e o autor contém o sobrenome; *O Messias de Duna* não é *Duna*. Traduções com outro título são outro livro, de propósito.

O Gutenberg ficou fora da busca automática: o gutendex.com, a API dele, leva mais de 20 s ou não responde em buscas fora do cache. Links do Gutenberg, do Domínio Público, do Wikisource e de bibliotecas entram pela comunidade.

## Wishlist do Goodreads

O Goodreads fechou a API em 2020. Sobram duas portas:

- **RSS da estante**: em *My Books → Want to Read*, role até o fim e copie o link *RSS*. Ele traz a chave da conta (`?key=…`); sem a chave o Goodreads responde 404. O link passa pelo servidor, porque o Goodreads não aceita chamadas de outra origem, e não fica guardado.
- **CSV**: *My Books → Import and export → Export Library*. É lido no próprio navegador (o arquivo traz resenhas e notas privadas); só título, autor e ISBN vão para as buscas. Entram os livros com `Exclusive Shelf = to-read`.

## Fontes da comunidade e moderação

Qualquer pessoa indica um link dizendo se é **digital** (ebook, leitura online, audiolivro) ou **físico** (sebo, livraria, biblioteca), o **preço** (ou *grátis*; vazio é "não informado") e uma nota de até 140 caracteres. O preço aceita como as pessoas escrevem: `28,30`, `R$ 1.234,56`, `28.30`. O servidor aceita só `http(s)` com domínio de verdade, sem usuário e senha; calcula a chave do livro ele mesmo; recusa o mesmo link duas vezes no mesmo livro; um campo escondido barra robôs simples. Cada fonte é um arquivo que nunca é reescrito, e cada denúncia é outro, então duas pessoas escrevendo ao mesmo tempo não se atropelam.

Na página, cada link da comunidade aparece com o domínio, "indicado por alguém" e **denunciar** (pirataria, link quebrado, livro errado, spam ou golpe, outro). **Com 3 denúncias o link some** até alguém revisar:

```bash
bun moderar.js                 # links denunciados, com os motivos
bun moderar.js recentes        # as últimas 30 fontes
bun moderar.js remover <id>    # apaga o link e as denúncias dele
bun moderar.js manter <id>     # apaga só as denúncias: o link volta
```

Pedidos de remoção também chegam por software@sinco.institute.

Não há limite de envios por pessoa (não há banco para contar). Se aparecer abuso, o próximo passo é um limite por IP no Vercel Firewall.

## Limites

- A Estante Virtual não tem API pública e fica atrás de um anti-robô (ShieldSquare). O endpoint JSON `/busca/api` cai no desafio rápido; a página de busca, não. Por isso uma busca por vez em cada servidor, o cache de 6 h no CDN (`GET /api/preco`: o mesmo livro pedido por outra pessoa não vira outra busca) e a wishlist guardada no navegador, que continua de onde parou. Se o desafio aparecer, o livres para e avisa.
- A Open Library às vezes demora; a lista de grátis espera até 8 s.
- O preço é o do anúncio, **sem frete**.
- Uma wishlist de 100 livros leva uns 4 minutos na primeira vez.

## Publicar

Projeto `livres` na Vercel, funções em `gru1` (perto da Estante), Blob `livres-fontes` (público, `gru1`). O site do sinco software repassa `/livres/` para cá (`vercel.json` dele), por isso todos os caminhos daqui são relativos.

```bash
npx vercel deploy --prod --scope sincos-projects-b8945148
```

`vercel.json` fixa o preset *Other*: com o preset *Node*, que a Vercel escolhe sozinha, a pasta inteira vira uma função e nada abre. Pelo mesmo motivo o script da página é `main.js`, não `app.js`.

## Arquivos

| arquivo | o quê |
| --- | --- |
| `index.html`, `main.js`, `styles.css` | interface no sistema do sinco software: temas (`T` avança, `Shift+T` volta), pílulas, cartões de vidro, Fragment Mono |
| `lib/texto.js` | normalização, título principal, sobrenome, chave, "mesma obra" |
| `lib/goodreads.js` | RSS (com páginas), CSV do export, ISBN-10 → 13; roda no servidor e no navegador |
| `lib/estante.js` | Estante Virtual: busca, anúncio, menor preço |
| `lib/gratis.js` | Open Library |
| `lib/fontes.js` | fontes da comunidade e denúncias no Blob |
| `api/*.js` | funções da Vercel: `preco`, `gratis`, `fontes`, `denuncia`, `recentes`, `estante` |
| `server.js` | `Bun.serve` local com as mesmas funções |
| `cli.js`, `moderar.js` | terminal: preços da wishlist; moderação |
| `test/` | `bun test` |
