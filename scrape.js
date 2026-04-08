const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const BASE = 'https://www.uffs.edu.br/uffs/restaurantes-universitarios';

const CAMPUS_VALIDOS = new Set([
  'campus-cerro-largo',
  'campus-chapeco',
  'campus-erechim',
  'campus-laranjeiras-do-sul',
  'campus-passo-fundo',
  'campus-realeza',
]);

/** Chave no estilo menuData.json */
const CAMPUS_PARA_CHAVE = {
  'campus-cerro-largo': 'cerro_largo',
  'campus-chapeco': 'chapeco',
  'campus-erechim': 'erechim',
  'campus-laranjeiras-do-sul': 'laranjeiras_do_sul',
  'campus-passo-fundo': 'passo_fundo',
  'campus-realeza': 'realeza',
};

/** Deslocamento a partir da segunda-feira da semana do cardápio */
const OFFSET_DIA_SEMANA = {
  'SEGUNDA-FEIRA': 0,
  'TERÇA-FEIRA': 1,
  'QUARTA-FEIRA': 2,
  'QUINTA-FEIRA': 3,
  'SEXTA-FEIRA': 4,
};

const nomesCampos = [
  'salada_1',
  'salada_2',
  'salada_3',
  'arroz_1',
  'arroz_2',
  'feijao',
  'guarnicao',
  'proteina',
  'opcao_vegetariana',
  'sobremesa',
];

function parseArgs() {
  const argv = process.argv.slice(2);
  let campus = null;
  let all = false;
  let assetsDir = null;
  for (const a of argv) {
    if (a === '--all') {
      all = true;
      continue;
    }
    if (a.startsWith('--campus=')) {
      campus = a.slice('--campus='.length).trim();
      continue;
    }
    if (a.startsWith('--assets-dir=')) {
      assetsDir = a.slice('--assets-dir='.length).trim();
      continue;
    }
  }
  if (!campus && argv[0] && !argv[0].startsWith('-')) {
    campus = argv[0].trim();
  }
  return { campus, all, assetsDir };
}

/** DD/MM/YY -> Date (local) */
function parseDataBR(s) {
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  const year = 2000 + Number(yy);
  return new Date(year, Number(mm) - 1, Number(dd));
}

function formatDataBR(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/** Extrai "dd/mm/yy a dd/mm/yy" do HTML */
function extrairPeriodoSemana($) {
  const texto = $('#texto, .conteudo').text();
  const match = texto.match(
    /Semana\s+(\d{2}\/\d{2}\/\d{2})\s+a\s+(\d{2}\/\d{2}\/\d{2})/i,
  );
  if (!match) return null;
  return { inicio: match[1], fim: match[2], texto: `Semana ${match[1]} a ${match[2]}` };
}

function addDias(date, n) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function enriquecerRefeicoesComData(refeicoes, segundaFeiraStr) {
  const base = parseDataBR(segundaFeiraStr);
  if (!base) {
    return refeicoes.map((r) => {
      const { dia, ...rest } = r;
      return { dia, data: null, ...rest };
    });
  }
  return refeicoes.map((r) => {
    const nome = (r.dia || '').trim().toUpperCase();
    const offset = OFFSET_DIA_SEMANA[nome];
    const data =
      offset === undefined ? null : formatDataBR(addDias(base, offset));
    const { dia, ...rest } = r;
    return { dia, data, ...rest };
  });
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'Accept-Language': 'pt-BR,pt;q=0.9',
      Accept: 'text/html',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao buscar ${url}`);
  }
  return response.text();
}

function extrairCardapio($) {
  const table = $('table.default.table.mrg-top-1').first();
  if (!table.length) {
    return { refeicoes: [], erro: 'Tabela de cardápio não encontrada' };
  }

  const headers = [];
  table.find('tr').first().find('th, td').each((_, cell) => {
    headers.push($(cell).text().trim().replace(/\s+/g, ' '));
  });

  const linhas = [];
  table.find('tr').slice(1).each((_, tr) => {
    const obj = {};
    $(tr).find('td').each((i, td) => {
      const key = headers[i] || `coluna_${i + 1}`;
      obj[key] = $(td).text().trim().replace(/\s+/g, ' ');
    });
    if (Object.keys(obj).length > 0) {
      linhas.push(obj);
    }
  });

  if (!linhas.length || !linhas[0]) {
    return { refeicoes: [], erro: 'Tabela vazia' };
  }

  const dias = Object.keys(linhas[0]);
  const refeicoes = dias.map((dia) => {
    const refeicao = { dia };
    linhas.forEach((linha, index) => {
      refeicao[nomesCampos[index] || `parte_${index + 1}`] = linha[dia] || null;
    });
    return refeicao;
  });

  return { refeicoes };
}

async function scrapeCampus(campus) {
  const url = `${BASE}/${campus}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const periodoBase = extrairPeriodoSemana($);
  const { refeicoes, erro } = extrairCardapio($);

  const segunda =
    periodoBase?.inicio ||
    (() => {
      const m = $('#texto, .conteudo')
        .text()
        .match(/(\d{2}\/\d{2}\/\d{2})\s+a\s+(\d{2}\/\d{2}\/\d{2})/i);
      return m ? m[1] : null;
    })();

  const comData = enriquecerRefeicoesComData(refeicoes, segunda);
  const chave = CAMPUS_PARA_CHAVE[campus];

  const saida = {
    [chave]: comData,
  };

  if (erro) {
    saida._erro = erro;
  }

  return saida;
}

function writeSaida(assetsDir, chave, saida) {
  fs.mkdirSync(assetsDir, { recursive: true });
  const filePath = path.join(assetsDir, `${chave}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(saida, null, 2)}\n`, 'utf8');
}

async function main() {
  const { campus, all, assetsDir } = parseArgs();

  if (all) {
    if (!assetsDir) {
      console.error('Com --all é obrigatório --assets-dir=<pasta>');
      process.exit(1);
    }
    for (const c of CAMPUS_VALIDOS) {
      const saida = await scrapeCampus(c);
      const chave = CAMPUS_PARA_CHAVE[c];
      writeSaida(assetsDir, chave, saida);
      console.error(`OK ${c} -> ${path.join(assetsDir, `${chave}.json`)}`);
    }
    return;
  }

  if (!campus) {
    console.error(
      'Uso: node scrape.js <campus>\n' +
        '     node scrape.js --campus=campus-chapeco\n' +
        '     node scrape.js --all --assets-dir=assets\n\n' +
        `Campi: ${[...CAMPUS_VALIDOS].join(', ')}`,
    );
    process.exit(1);
  }
  if (!CAMPUS_VALIDOS.has(campus)) {
    console.error(`Campus inválido: ${campus}. Use um dos valores listados na ajuda.`);
    process.exit(1);
  }

  const saida = await scrapeCampus(campus);

  if (assetsDir) {
    const chave = CAMPUS_PARA_CHAVE[campus];
    writeSaida(assetsDir, chave, saida);
    console.error(`OK -> ${path.join(assetsDir, `${chave}.json`)}`);
  } else {
    console.log(JSON.stringify(saida, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
