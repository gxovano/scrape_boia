# scrape_boia

## Disclaimer

**Este projeto foi elaborado inteiramente com assistência de LLM (modelo de linguagem grande).** O código, a documentação e as decisões de implementação resultam desse processo. Revise o comportamento, a licença dos dados extraídos e o uso em produção antes de depender deste repositório para qualquer fim.

---
Ferramenta em Node.js que obtém o cardápio dos Restaurantes Universitários da UFFS a partir do site institucional e exporta os dados em JSON — um ficheiro por campus na pasta `assets/`.

## Requisitos

- [Node.js](https://nodejs.org/) 18+ (usa `fetch` nativo)

## Instalação

```bash
npm ci
```

## Uso

Gerar JSON para **todos** os campi em `assets/`:

```bash
npm run generate-assets
```

Gerar JSON para **um** campus (imprime no stdout):

```bash
node scrape.js campus-chapeco
# ou
node scrape.js --campus=campus-chapeco
```

Gravar um único campus em ficheiro:

```bash
node scrape.js --campus=campus-chapeco --assets-dir=assets
```

Campi suportados: `campus-cerro-largo`, `campus-chapeco`, `campus-erechim`, `campus-laranjeiras-do-sul`, `campus-passo-fundo`, `campus-realeza`.

## GitHub Actions

O workflow [`.github/workflows/update-assets.yml`](.github/workflows/update-assets.yml) executa o scrape a cada três horas (UTC), atualiza `assets/` e faz commit quando há alterações. Também pode ser disparado manualmente em **Actions → Atualizar assets dos campi → Run workflow**.

## Dados

Os ficheiros em `assets/` seguem o padrão `<chave>.json` (por exemplo `chapeco.json`), com a estrutura definida em `scrape.js`. O conteúdo depende da página da UFFS; em caso de mudança de HTML, o scrape pode precisar de ajustes.

---
