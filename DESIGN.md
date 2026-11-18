# DESIGN.md · sinco livres

> If this file and the code disagree, the code wins until the person decides. Note the conflict under Open questions.

## Product
Onde ler cada livro: de graça, na biblioteca ou no sebo mais barato. Um índice aberto, sem conta, feito por quem usa: qualquer pessoa busca um livro, vê as fontes digitais e físicas com preço ou "grátis" e indica novas fontes (e, em breve, novos livros que a Open Library não tem). A página do livro é um perfil no jeito do Goodreads.
Em etapas: agora o índice aberto; contas, leitor de ebook e uma loja própria vêm depois.
Main job: achar onde ler um livro em menos de um minuto. Devices: celular e computador (assumed: os dois na mesma medida).

## Audience and voice
Leitores no Brasil, de estudantes a quem compra em sebo. Curto, direto, minúsculas quando der, metadados em mono. Português do Brasil; dinheiro R$ 28,30; datas relativas ("há 5 minutos").

## Mood
Words: quieto, techno-nature, uma frase por vez (do brief da sinco e das refs do institute). Never like: (assumed) loja ruidosa de marketplace, rede social com contadores e badges, gradiente e neon.

## Brand
Design system source: `styles.css` (copiado do site do sinco software, `software/sites/software/styles.css`).
- Temas: tabaco (padrão), cinza, terra, musgo, argila, chumbo, noite — `--fundo`, `--tinta`, `--cartao`, `--tecla`, `--tecla-texto`. `T` avança, `Shift+T` volta.
- Tipos: Helvetica Neue / Inter 300–400 no texto; Fragment Mono 11–13px nos metadados.
- Peças: pílula com `kbd`, cartão de vidro (blur 14px, raio 5px), selo ⊃⊂ + nome em 24px light, grade de 12 colunas com o conteúdo começando na 4ª.
- Cor só da fotografia e das capas; a interface é monocromática.

## References
- Goodreads — take: o perfil do livro (capa grande à esquerda, ficha, nota, sinopse com "mais", edições); avoid: (assumed) a densidade de anúncios, widgets e listas na lateral.
- re:arc institute / Kunumi (`institute/refs`) — take: uma frase grande no centro, interface quase invisível, foco como hierarquia; avoid: (assumed) a navegação que esconde o conteúdo.
- procedural.computer (base do site do sinco software) — take: a forma no fundo, o About em cartões; avoid: —.

## Constraints
Web, sem build (HTML, CSS e JS puros); roda em `software.sinco.institute/livres/`, então todo caminho é relativo. Celular até 760px. Sete temas claros e escuros. `prefers-reduced-motion` respeitado. Movimento curto, `ease-out`, só para entrar e confirmar.

## Decisions log
- 2026-11-17 — Fontes do livro em duas listas, digital e físico, cada uma com preço ou "grátis" — pedido do Pedro; é a pergunta que o leitor faz ("tenho em papel? de graça?").
- 2026-11-17 — Página do livro como perfil no jeito do Goodreads — pedido do Pedro.
- 2026-11-17 — Contas só depois, junto com leitor de ebook e loja — pedido do Pedro; o índice aberto vem primeiro.
- 2026-11-17 — Hero do início: "quero ler ___" com a estante viva atrás, sem cartão — escolha do Pedro entre três opções (frase + faixa, estante viva com vidro, pergunta); combinou a pergunta com o campo de capas. A lacuna é a busca e gira por livros reais com a resposta do livres embaixo.
- 2026-11-17 — A estante viva mostra indicações recentes (com capa) e, completando, livros com leitura aberta em edição portuguesa na Open Library, publicados antes de 1950 — dados reais desde o primeiro dia; o corte de 1950 tira livros recentes que a Open Library marca como abertos.
- 2026-11-17 — Legibilidade sem cartão: uma névoa da cor do fundo atrás da frase, não uma máscara nas capas — a máscara apagava o hover e deixava o campo sujo.
- 2026-11-17 — A frase fica ancorada a partir do topo (não centralizada) — os resultados crescem para baixo sem a frase pular.
- 2026-11-17 — Novos tamanhos só no hero: frase de 64px (40px no celular) — ainda não viraram token; entram no sistema se outra tela precisar.
- 2026-11-17 — Manter estilo e clima atuais; redesenhar só o hero — pedido do Pedro.

## Open questions
- Celular ou computador primeiro? (assumed: os dois)
- O que o livres nunca pode parecer? (assumed acima, em Mood)
- O que evitar do Goodreads e das refs do institute? (assumed acima)
- Importar o sistema para o Paper? (perguntado em 2026-11-17)
