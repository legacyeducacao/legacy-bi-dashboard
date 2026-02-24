
/**
 * Script para gerar a base de dados do BI Legacy Educação.
 * Inclui API (doGet) para leitura e Webhook (doPost) para escrita automática.
 */

function criarBaseDeDadosBI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // --- 1. CONFIGURAÇÃO DA ABA: KPIs_Principais ---
  const kpiData = [
    ['invest', 'Investimento Ads', 15450, 25000, 'currency', 'R$ ', ''], 
    ['leads', 'Leads Totais', 850, 1200, 'number', '', ''], 
    ['cpl', 'CPL Médio', '=IFERROR(C2/C3; 0)', 20.00, 'currency', 'R$ ', ''], 
    ['mkt_revenue', 'Receita Marketing', 185000, 300000, 'currency', 'R$ ', ''], 
    ['mkt_sales', 'Vendas Marketing', 12, 20, 'number', '', ''], 
    ['cac', 'CAC Blended', '=IFERROR(C2/C6; 0)', 1500, 'currency', 'R$ ', ''], 
    ['ltv', 'LTV Médio', 32000, 30000, 'currency', 'R$ ', ''], 
    ['roas', 'ROAS Macro', '=IFERROR(C5/C2; 0)', 12, 'number', '', 'x'], 
    ['mqls', 'MQLs', 210, 350, 'number', '', ''], 
    ['cpmql', 'Custo por MQL', '=IFERROR(C2/C10; 0)', 80, 'currency', 'R$ ', ''], 
    ['opps', 'Oportunidades', 650, 900, 'number', '', ''], 
    ['connections', 'Conexões', 325, 450, 'number', '', ''], 
    ['meetings_booked', 'Reuniões Agendadas', 65, 100, 'number', '', ''], 
    ['meetings_held', 'Reuniões Realizadas', 48, 85, 'number', '', ''], 
    ['response_time', 'Tempo de Resposta', 12, 15, 'time', '', ' min'], 
    ['revenue', 'Faturamento Total', 185000, 300000, 'currency', 'R$ ', ''], 
    ['ticket', 'Ticket Médio', '=IFERROR(C17/C6; 0)', 15000, 'currency', 'R$ ', ''] 
  ];

  configurarAba(ss, 'KPIs_Principais', 
    ['ID', 'Nome da Métrica', 'Valor Atual', 'Meta Mensal', 'Unidade', 'Prefixo', 'Sufixo'], 
    kpiData
  );


  // --- 2. CONFIGURAÇÃO DA ABA: Canais_Marketing ---
  const canaisRaw = [
    ['Google Ads (Search)', 8500, 280, 95, 5, 75000],
    ['Meta Ads (Insta/FB)', 5000, 350, 60, 3, 45000],
    ['LinkedIn Ads', 1950, 50, 25, 2, 35000],
    ['Orgânico / SEO', 0, 120, 20, 1, 15000],
    ['Indicação / Email', 0, 50, 10, 1, 15000]
  ];

  const canaisData = canaisRaw.map((row, i) => {
    const r = i + 2; 
    return [
      row[0], // Canal
      row[1], // Invest
      row[2], // Leads
      `=IFERROR(B${r}/C${r}; 0)`, // CPL Formula
      row[3], // MQLs
      row[4], // Vendas
      row[5], // Receita
      `=IFERROR(G${r}/B${r}; 0)`  // ROAS Formula
    ];
  });

  configurarAba(ss, 'Canais_Marketing', 
    ['Canal', 'Investimento', 'Leads', 'CPL', 'MQLs', 'Vendas', 'Receita', 'ROAS'], 
    canaisData
  );


  // --- 3. CONFIGURAÇÃO DA ABA: Produtos ---
  const produtosRaw = [
    ['Legado Empresarial', 6000, 150, 3, 90000],
    ['Imersão de 1 Dia', 2500, 300, 5, 10000],
    ['Imersão de 3 Dias', 3500, 200, 2, 30000],
    ['Legado Incompany', 1500, 40, 1, 40000],
    ['Inteligência Empresarial', 1950, 160, 1, 15000]
  ];

  const produtosData = produtosRaw.map((row, i) => {
    const r = i + 2;
    return [
      row[0], // Produto
      row[1], // Invest
      row[2], // Leads
      `=IFERROR(B${r}/C${r}; 0)`, // CPL Formula
      row[3], // Vendas
      row[4], // Receita
      `=IFERROR(F${r}/B${r}; 0)`  // ROAS Formula
    ];
  });

  configurarAba(ss, 'Produtos', 
    ['Produto', 'Investimento', 'Leads', 'CPL', 'Vendas', 'Receita', 'ROAS'], 
    produtosData
  );


  // --- 4. CONFIGURAÇÃO DA ABA: Tendencia_Diaria (ATUALIZADO) ---
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth(); 
  const diaDeHoje = hoje.getDate();
  const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();

  const tendenciasData = Array.from({ length: diasNoMes }, (_, i) => {
    const dia = i + 1;
    const dataObj = new Date(anoAtual, mesAtual, dia);
    // Formato YYYY-MM-DD
    const mesFormat = (mesAtual + 1).toString().padStart(2, '0');
    const diaFormat = dia.toString().padStart(2, '0');
    const dataString = `${anoAtual}-${mesFormat}-${diaFormat}`;
    
    // Mock inicial
    const isWeekend = dataObj.getDay() === 0 || dataObj.getDay() === 6;
    const invest = Math.floor(Math.random() * 600) + 400;
    const leads = Math.floor(invest / (20 + Math.random() * 15));
    const mqls = Math.floor(leads * 0.3);
    let sales = 0;
    if (!isWeekend) {
       sales = Math.random() > 0.7 ? 1 : 0; 
       if (Math.random() > 0.9) sales = 2; 
    }
    const revenue = sales * 15000;
    const activities = isWeekend ? 0 : Math.floor(Math.random() * 50) + 30;
    const connections = Math.floor(activities * 0.25);

    return [
      `Dia ${dia}`, 
      dataString, 
      leads, 
      mqls, 
      invest, 
      revenue, 
      sales, 
      activities, 
      connections
    ];
  });
  
  configurarAba(ss, 'Tendencia_Diaria', 
    ['Dia', 'Data', 'Leads', 'MQLs', 'Investimento (R$)', 'Faturamento (R$)', 'Vendas', 'Atividades', 'Conexões'], 
    tendenciasData
  );


  // --- 5. Abas Simples (Times) ---
  const sdrData = [
    ['1', 'Ana Silva', 200, 110, 22, 18, 4, 8],
    ['2', 'Carlos Souza', 180, 85, 15, 10, 5, 25],
    ['3', 'Beatriz Costa', 150, 80, 20, 15, 5, 12],
    ['4', 'João Pereira', 120, 50, 8, 5, 3, 45]
  ];
  configurarAba(ss, 'Time_SDR', 
    ['ID', 'Nome', 'Oportunidades', 'Conexões', 'Reuniões Agendadas', 'Reuniões Realizadas', 'No Show', 'Tempo Resp (min)'], 
    sdrData
  );

  const closerData = [
    ['10', 'Roberto Lima', 20, 6, 95000, 5, 25],
    ['11', 'Fernanda Alves', 18, 4, 60000, 4, 22],
    ['12', 'Ricardo Gois', 10, 2, 30000, 8, 18]
  ];
  configurarAba(ss, 'Time_Closers', 
    ['ID', 'Nome', 'Reuniões Realizadas', 'Vendas', 'Faturamento Gerado', 'No Show Count', 'Reuniões Agendadas'], 
    closerData
  );

  // --- 6. Configurações Gerais (Dinâmicas) ---
  const configData = [
    ['Dia Atual do Mês', diaDeHoje],
    ['Total Dias do Mês', diasNoMes],
    ['Data da Última Atualização', new Date()]
  ];
  configurarAba(ss, 'Configuracoes_Gerais', ['Configuração', 'Valor'], configData);
}

function configurarAba(ss, nomeAba, headers, data) {
  let sheet = ss.getSheetByName(nomeAba);
  if (!sheet) {
    sheet = ss.insertSheet(nomeAba);
  } else {
    sheet.clear();
  }

  // Set Headers
  if (headers.length > 0) {
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');
  }

  // Set Data
  if (data.length > 0) {
    const range = sheet.getRange(2, 1, data.length, headers.length);
    range.setValues(data); 
  }

  sheet.autoResizeColumns(1, headers.length);
}

/**
 * API GET: Retorna todos os dados da planilha em JSON para o Dashboard
 */
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const output = {};
  
  const sheets = ss.getSheets();
  
  sheets.forEach(sheet => {
    const nome = sheet.getName();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    output[nome] = rows.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
  });
  
  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * API POST: Webhook para receber dados e atualizar a planilha
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000); 

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Tendencia_Diaria');
    
    if (!e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No data found' }));
    }

    const data = JSON.parse(e.postData.contents);
    let targetDateStr = data.date;
    if (!targetDateStr) {
      const hoje = new Date();
      targetDateStr = `${hoje.getFullYear()}-${(hoje.getMonth()+1).toString().padStart(2,'0')}-${hoje.getDate().toString().padStart(2,'0')}`;
    }

    const values = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < values.length; i++) {
       let cellDate = values[i][1];
       if (cellDate instanceof Date) {
          cellDate = `${cellDate.getFullYear()}-${(cellDate.getMonth()+1).toString().padStart(2,'0')}-${cellDate.getDate().toString().padStart(2,'0')}`;
       }
       if (cellDate === targetDateStr) {
         rowIndex = i + 1;
         break;
       }
    }

    if (rowIndex === -1) {
       return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Date row not found' }));
    }
    
    const colMap = {
      'add_lead': 3,
      'add_mql': 4,
      'add_invest': 5,
      'add_revenue': 6,
      'add_sale': 7,
      'add_activity': 8,
      'add_connection': 9
    };

    const colIndex = colMap[data.action];
    const valorParaSomar = Number(data.value) || 0;

    if (colIndex) {
      const cell = sheet.getRange(rowIndex, colIndex);
      const currentValue = Number(cell.getValue()) || 0;
      cell.setValue(currentValue + valorParaSomar);
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', newValue: currentValue + valorParaSomar })).setMimeType(ContentService.MimeType.JSON);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' }));
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }));
  } finally {
    lock.releaseLock();
  }
}
