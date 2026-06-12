// ═══════════════════════════════════════════════════════════════════════════
// PAINEL ESTEIRA — Apps Script Backend
// Planilha: MODELO_HORA_A_HORA
// ═══════════════════════════════════════════════════════════════════════════

var ABA_PRODUTO  = "PRODUTO_CODIGO";
var ABA_HORA     = "HORA_A_HORA";
var ABA_PARADAS  = "PARADAS";
var ABA_CONFIG   = "CONFIG";
var ABA_PROG     = "PROGRAMACAO";

// ── RESPONSE HELPER ──────────────────────────────────────────────────────────

function makeResponse(data) {
  var json = JSON.stringify(data);
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function ok(data) {
  return makeResponse({ ok: true, data: data });
}

function err(msg) {
  return makeResponse({ ok: false, error: String(msg) });
}

// ── doGet ────────────────────────────────────────────────────────────────────

function doGet(e) {
  try {
    var acao = (e.parameter.acao || "").trim();

    if (acao === "produtos") {
      return ok(getProdutos());
    }
    if (acao === "buscarEAN") {
      var ean = (e.parameter.ean || "").trim();
      return ok(buscarPorEAN(ean));
    }
    if (acao === "buscarCodigo") {
      var codigo = (e.parameter.codigo || "").trim();
      return ok(buscarPorCodigo(codigo));
    }
    if (acao === "registros") {
      var data  = (e.parameter.data  || "").trim();
      var linha = (e.parameter.linha || "").trim();
      return ok(getRegistros(data, linha));
    }
    if (acao === "config") {
      return ok(getConfig());
    }
    if (acao === "getProgramacao") {
      var data = (e.parameter.data || "").trim();
      return ok(getProgramacao(data));
    }

    return err("acao invalida: " + acao);
  } catch (ex) {
    return err(ex.message);
  }
}

// ── doPost ───────────────────────────────────────────────────────────────────

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Evita corrida entre gravações concorrentes (ex.: dois usuários salvando
    // a programação ao mesmo tempo — delete+insert poderia duplicar/perder linhas)
    lock.waitLock(20000);

    var acao = (e.parameter.acao || "").trim();
    var body = {};

    try {
      body = JSON.parse(e.postData.contents || "{}");
    } catch (parseErr) {
      return err("JSON inválido: " + parseErr.message);
    }

    if (acao === "salvarRegistro") {
      salvarRegistro(body);
      return ok(null);
    }
    if (acao === "salvarParada") {
      salvarParada(body);
      return ok(null);
    }
    if (acao === "salvarProgramacao") {
      salvarProgramacao(body);
      return ok(null);
    }

    return err("acao invalida: " + acao);
  } catch (ex) {
    return err(ex.message);
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

// ── PRODUTO_CODIGO ────────────────────────────────────────────────────────────
// Colunas: A=CODIGO B=DESCRICAO C=PB D=EAN128 E=MEDIDA(mm) F=VEL(m/min) G=ENTRE_PECAS(mm) H=PONTOS

function getProdutos() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_PRODUTO);
  if (!sheet) return [];

  var rows = sheet.getDataRange().getValues();
  var result = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    result.push({
      codigo:      String(r[0] || "").trim(),
      descricao:   String(r[1] || "").trim(),
      pb:          String(r[2] || "").trim(),
      ean128:      String(r[3] || "").trim(),
      medida:      parseFloat(r[4]) || 0,
      vel:         parseFloat(r[5]) || 0,
      entre_pecas: parseFloat(r[6]) || 0,
      pontos:      parseFloat(r[7]) || 0
    });
  }

  return result;
}

function buscarPorEAN(ean) {
  if (!ean) return null;
  var produtos = getProdutos();
  for (var i = 0; i < produtos.length; i++) {
    if (produtos[i].ean128 === ean) return produtos[i];
  }
  return null;
}

function normCodigo(s) {
  return String(s || "").replace(/\./g, "").replace(/\s/g, "").toUpperCase();
}

function buscarPorCodigo(codigo) {
  if (!codigo) return null;
  var norm = normCodigo(codigo);
  var produtos = getProdutos();
  for (var i = 0; i < produtos.length; i++) {
    if (normCodigo(produtos[i].codigo) === norm) return produtos[i];
  }
  return null;
}

// ── HORA_A_HORA ───────────────────────────────────────────────────────────────
// Colunas: A=Data B=Linha C=Produto D=VEL E=MEDIDA F=MIN_P G=Meta H=Realizado
//          I=Saldo J=Pct K=Acum_real L=Acum_meta M=Eficiencia N=Projecao O=Periodo P=EntrePecas

function getRegistros(data, linha) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_HORA);
  if (!sheet) return [];

  var tz   = Session.getScriptTimeZone();
  var rows = sheet.getDataRange().getValues();
  var result = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;

    var rowData  = "";
    try {
      rowData = Utilities.formatDate(r[0], tz, "dd/MM/yyyy");
    } catch (ex) {
      rowData = String(r[0]);
    }
    var rowLinha = String(r[1] || "").trim();

    var dataMatch  = !data  || rowData  === data;
    var linhaMatch = !linha || rowLinha === linha;
    if (!dataMatch || !linhaMatch) continue;

    result.push({
      data:       rowData,
      linha:      rowLinha,
      produto:    String(r[2] || "").trim(),
      vel:        parseFloat(r[3])  || 0,
      medida:     parseFloat(r[4])  || 0,
      min_p:      parseFloat(r[5])  || 0,
      meta:       parseFloat(r[6])  || 0,
      realizado:  parseFloat(r[7])  || 0,
      saldo:      parseFloat(r[8])  || 0,
      pct:        parseFloat(r[9])  || 0,
      acum_real:  parseFloat(r[10]) || 0,
      acum_meta:  parseFloat(r[11]) || 0,
      eficiencia:  parseFloat(r[12]) || 0,
      projecao:    parseFloat(r[13]) || 0,
      periodo:     String(r[14] || "").trim(),
      entre_pecas: parseFloat(r[15]) || 0
    });
  }

  return result;
}

function salvarRegistro(body) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_HORA);
  if (!sheet) throw new Error("Aba " + ABA_HORA + " não encontrada.");

  var tz       = Session.getScriptTimeZone();
  var rows     = sheet.getDataRange().getValues();
  var dataFmt  = String(body.data  || "").trim();
  var linhaStr = String(body.linha || "").trim();
  var periodoStr = String(body.periodo || "").trim();

  var targetRow = -1;
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    var rowData = "";
    try {
      rowData = Utilities.formatDate(r[0], tz, "dd/MM/yyyy");
    } catch (ex) {
      rowData = String(r[0]);
    }
    var rowLinha  = String(r[1]  || "").trim();
    var rowPer    = String(r[14] || "").trim();

    if (rowData === dataFmt && rowLinha === linhaStr && rowPer === periodoStr) {
      targetRow = i + 1;
      break;
    }
  }

  var dateObj = parseDataBR(body.data);
  var rowValues = [
    dateObj,
    body.linha     || "",
    body.produto   || "",
    parseFloat(body.vel)       || 0,
    parseFloat(body.medida)    || 0,
    parseFloat(body.min_p)     || 0,
    parseFloat(body.meta)      || 0,
    parseFloat(body.realizado) || 0,
    parseFloat(body.saldo)     || 0,
    parseFloat(body.pct)       || 0,
    parseFloat(body.acum_real) || 0,
    parseFloat(body.acum_meta) || 0,
    parseFloat(body.eficiencia)  || 0,
    parseFloat(body.projecao)    || 0,
    periodoStr,
    parseFloat(body.entre_pecas) || 0
  ];

  if (targetRow > 0) {
    sheet.getRange(targetRow, 1, 1, rowValues.length).setValues([rowValues]);
  } else {
    sheet.appendRow(rowValues);
  }
}

// ── PARADAS ───────────────────────────────────────────────────────────────────

function salvarParada(body) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_PARADAS);
  if (!sheet) throw new Error("Aba " + ABA_PARADAS + " não encontrada.");

  var dateObj  = parseDataBR(body.data);
  var inicio   = String(body.inicio  || "").trim();
  var fim      = String(body.fim     || "").trim();
  var motivo   = String(body.motivo  || "").trim();
  var minutos  = parseFloat(body.minutos) || calcMinutos(inicio, fim);

  sheet.appendRow([dateObj, body.linha || "", inicio, fim, minutos, motivo]);
}

function calcMinutos(inicio, fim) {
  try {
    var ini = parseHHMM(inicio);
    var end = parseHHMM(fim);
    var diff = (end - ini) / 60000;
    return diff >= 0 ? diff : 0;
  } catch (ex) {
    return 0;
  }
}

function parseHHMM(str) {
  var parts = String(str).split(":");
  var h = parseInt(parts[0]) || 0;
  var m = parseInt(parts[1]) || 0;
  var d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

// ── CONFIG ────────────────────────────────────────────────────────────────────

function getConfig() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_CONFIG);

  if (!sheet) {
    sheet = ss.insertSheet(ABA_CONFIG);
    var defaults = [
      ["TURNO_INICIO",    "07:00"],
      ["TURNO_FIM",       "16:45"],
      ["TOTAL_MIN",       513],
      ["FATOR_ACELERACAO",1.10]
    ];
    sheet.getRange(1, 1, defaults.length, 2).setValues(defaults);
  }

  var rows = sheet.getDataRange().getValues();
  var cfg  = {};
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0]) cfg[String(rows[i][0]).trim()] = rows[i][1];
  }
  return cfg;
}

// ── PROGRAMACAO ───────────────────────────────────────────────────────────────
// Colunas: A=Data B=Ordem C=Codigo D=Descricao E=Qtd_cx F=Vel G=Medida
//          H=Entre_pecas I=Troca_min J=CxMin K=Tempo_min L=Hora_inicio M=Hora_fim
// (layout antigo, sem Troca_min na coluna I, é detectado pelo cabeçalho)

function getProgramacao(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_PROG);
  if (!sheet) return [];

  var tz   = Session.getScriptTimeZone();
  var rows = sheet.getDataRange().getValues();
  var result = [];

  // layout novo tem "Troca" no cabeçalho da coluna I; senão usa os índices antigos
  var hasTroca = rows.length > 0 && String(rows[0][8] || "").toLowerCase().indexOf("troca") >= 0;
  var iTroca = hasTroca ? 8 : -1;
  var iCxMin = hasTroca ? 9 : 8, iTempo = hasTroca ? 10 : 9;
  var iIni   = hasTroca ? 11 : 10, iFim  = hasTroca ? 12 : 11;

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    var rowData = "";
    try { rowData = Utilities.formatDate(r[0], tz, "dd/MM/yyyy"); }
    catch (ex) { rowData = String(r[0]); }
    if (data && rowData !== data) continue;
    result.push({
      data:         rowData,
      ordem:        parseInt(r[1]) || 0,
      codigo:       String(r[2] || "").trim(),
      descricao:    String(r[3] || "").trim(),
      qtd_cx:       parseFloat(r[4])  || 0,
      vel:          parseFloat(r[5])  || 0,
      medida:       parseFloat(r[6])  || 0,
      entre_pecas:  parseFloat(r[7])  || 0,
      troca_min:    iTroca >= 0 ? (parseFloat(r[iTroca]) || 0) : 0,
      cx_min:       parseFloat(r[iCxMin]) || 0,
      tempo_min:    parseFloat(r[iTempo]) || 0,
      hora_inicio:  String(r[iIni] || "").trim(),
      hora_fim:     String(r[iFim] || "").trim(),
      pb:           0,
      pontos:       0
    });
  }

  // Enriquece com dados do cadastro de produtos (vel, medida, pb, pontos)
  var produtos = getProdutos();
  for (var j = 0; j < result.length; j++) {
    var item = result[j];
    for (var k = 0; k < produtos.length; k++) {
      if (produtos[k].codigo === item.codigo) {
        if (item.vel         === 0) item.vel         = produtos[k].vel;
        if (item.medida      === 0) item.medida      = produtos[k].medida;
        if (item.entre_pecas === 0) item.entre_pecas = produtos[k].entre_pecas;
        if (!item.descricao)        item.descricao   = produtos[k].descricao;
        item.pb     = parseFloat(produtos[k].pb)     || 0;
        item.pontos = parseFloat(produtos[k].pontos) || 0;
        break;
      }
    }
  }

  result.sort(function(a, b) { return a.ordem - b.ordem; });
  return result;
}

function salvarProgramacao(body) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ABA_PROG);

  if (!sheet) {
    sheet = ss.insertSheet(ABA_PROG);
    sheet.getRange(1, 1, 1, 13).setValues([[
      "Data","Ordem","Codigo","Descricao","Qtd_cx","Vel","Medida",
      "Entre_pecas","Troca_min","CxMin","Tempo_min","Hora_inicio","Hora_fim"
    ]]);
  } else {
    // migra planilha antiga: insere a coluna I (Troca_min) deslocando as demais
    var hdrI = String(sheet.getRange(1, 9).getValue() || "");
    if (hdrI.toLowerCase().indexOf("troca") < 0) {
      sheet.insertColumnBefore(9);
      sheet.getRange(1, 9).setValue("Troca_min");
    }
  }

  var tz      = Session.getScriptTimeZone();
  var dataStr = String(body.data || "").trim();
  var itens   = body.itens || [];

  // Remove todas as linhas do dia
  var rows = sheet.getDataRange().getValues();
  var toDelete = [];
  for (var i = rows.length - 1; i >= 1; i--) {
    if (!rows[i][0]) continue;
    var rowData = "";
    try { rowData = Utilities.formatDate(rows[i][0], tz, "dd/MM/yyyy"); }
    catch (ex) { rowData = String(rows[i][0]); }
    if (rowData === dataStr) toDelete.push(i + 1);
  }
  toDelete.forEach(function(row) { sheet.deleteRow(row); });

  // Insere novos itens
  var dateObj = parseDataBR(dataStr);
  itens.forEach(function(item, idx) {
    sheet.appendRow([
      dateObj,
      idx + 1,
      item.codigo      || "",
      item.descricao   || "",
      parseFloat(item.qtd_cx)     || 0,
      parseFloat(item.vel)        || 0,
      parseFloat(item.medida)     || 0,
      parseFloat(item.entre_pecas)|| 0,
      parseFloat(item.troca_min)  || 0,
      parseFloat(item.cx_min)     || 0,
      parseFloat(item.tempo_min)  || 0,
      item.hora_inicio || "",
      item.hora_fim    || ""
    ]);
  });
}

// ── DATE HELPER ───────────────────────────────────────────────────────────────

function parseDataBR(str) {
  var parts = String(str || "").split("/");
  if (parts.length === 3) {
    var d = parseInt(parts[0]);
    var m = parseInt(parts[1]) - 1;
    var y = parseInt(parts[2]);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      return new Date(y, m, d);
    }
  }
  // Antes devolvia a data de hoje silenciosamente — registro caía no dia errado.
  throw new Error("Data inválida (esperado dd/MM/yyyy): " + str);
}
