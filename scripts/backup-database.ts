import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load environment variables if present locally
dotenv.config();

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ [BACKUP ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// All database tables in TutorNote APG
const TABLES_TO_BACKUP = [
  'semestres',
  'sois',
  'turmas',
  'mesas',
  'alunos',
  'alocacoes_mesa',
  'historico_alocacoes_mesa',
  'contribuicao_estudantes',
  'casos_apg',
  'avaliacoes',
  'anotacoes_mesa',
  'configuracoes',
  'profiles',
];

interface TableBackupResult {
  tableName: string;
  count: number;
  records: any[];
  error?: string;
}

async function fetchTableData(tableName: string): Promise<TableBackupResult> {
  const PAGE_SIZE = 1000;
  let allRecords: any[] = [];
  let from = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        // Table might not exist or RLS might block if anon key is used
        return {
          tableName,
          count: 0,
          records: [],
          error: error.message,
        };
      }

      if (data && data.length > 0) {
        allRecords = allRecords.concat(data);
        from += PAGE_SIZE;
        if (data.length < PAGE_SIZE) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    return {
      tableName,
      count: allRecords.length,
      records: allRecords,
    };
  } catch (err: any) {
    return {
      tableName,
      count: 0,
      records: [],
      error: err?.message || String(err),
    };
  }
}

function escapeSqlValue(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generateSqlDump(results: TableBackupResult[], timestamp: string): string {
  let sql = `-- ==========================================================\n`;
  sql += `-- TutorNote APG - Snapshot de Backup do Banco de Dados\n`;
  sql += `-- Gerado em: ${timestamp}\n`;
  sql += `-- ==========================================================\n\n`;

  for (const table of results) {
    if (table.records.length === 0) continue;

    sql += `-- ---------------------------------------------------------\n`;
    sql += `-- Tabela: ${table.tableName} (${table.records.length} registros)\n`;
    sql += `-- ---------------------------------------------------------\n`;

    for (const record of table.records) {
      const columns = Object.keys(record);
      const values = columns.map((col) => escapeSqlValue(record[col]));

      sql += `INSERT INTO public.${table.tableName} (${columns.join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`;
    }
    sql += `\n`;
  }

  return sql;
}

async function runBackup() {
  const startTime = new Date();
  const dateStr = startTime.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = startTime.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
  const backupId = `tutornote_backup_${dateStr}_${timeStr}`;

  console.log(`\n======================================================`);
  console.log(`🚀 Iniciando Rotina de Backup TutorNote APG`);
  console.log(`📅 Data/Hora: ${startTime.toISOString()} (UTC)`);
  console.log(`🎯 Destino Supabase: ${SUPABASE_URL}`);
  console.log(`======================================================\n`);

  const results: TableBackupResult[] = [];
  let totalRecords = 0;

  for (const tableName of TABLES_TO_BACKUP) {
    process.stdout.write(`⏳ Extraindo tabela '${tableName}'... `);
    const res = await fetchTableData(tableName);
    results.push(res);

    if (res.error) {
      console.log(`⚠️ Aviso: ${res.error}`);
    } else {
      console.log(`✅ ${res.count} registros`);
      totalRecords += res.count;
    }
  }

  // Ensure backups directory exists
  const backupsDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // Construct complete JSON Backup payload
  const backupPayload = {
    metadata: {
      backupId,
      createdAt: startTime.toISOString(),
      timestamp: startTime.getTime(),
      totalTables: TABLES_TO_BACKUP.length,
      totalRecords,
      supabaseUrl: SUPABASE_URL,
      version: '1.0.0',
    },
    tables: results.reduce((acc, curr) => {
      acc[curr.tableName] = {
        count: curr.count,
        records: curr.records,
        error: curr.error,
      };
      return acc;
    }, {} as Record<string, any>),
  };

  // Write JSON snapshot
  const jsonFilename = `${backupId}.json`;
  const jsonPath = path.join(backupsDir, jsonFilename);
  fs.writeFileSync(jsonPath, JSON.stringify(backupPayload, null, 2), 'utf-8');

  // Write latest.json for quick reference
  const latestJsonPath = path.join(backupsDir, 'latest_backup.json');
  fs.writeFileSync(latestJsonPath, JSON.stringify(backupPayload, null, 2), 'utf-8');

  // Write SQL dump
  const sqlDump = generateSqlDump(results, startTime.toISOString());
  const sqlFilename = `${backupId}.sql`;
  const sqlPath = path.join(backupsDir, sqlFilename);
  fs.writeFileSync(sqlPath, sqlDump, 'utf-8');

  // Write a summary info file for GitHub Actions to read
  const summaryMarkdown = `### 📦 Relatório do Backup Automático
- **ID do Backup:** \`${backupId}\`
- **Data/Hora:** ${startTime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Horário de Brasília)
- **Total de Tabelas Processadas:** ${TABLES_TO_BACKUP.length}
- **Total de Registros Salvos:** ${totalRecords}
- **Arquivos Gerados:**
  - \`backups/${jsonFilename}\` (${(fs.statSync(jsonPath).size / 1024).toFixed(1)} KB)
  - \`backups/${sqlFilename}\` (${(fs.statSync(sqlPath).size / 1024).toFixed(1)} KB)

| Tabela | Registros | Status |
| :--- | :---: | :--- |
${results.map((r) => `| \`${r.tableName}\` | ${r.count} | ${r.error ? `⚠️ ${r.error}` : '✅ Sucesso'} |`).join('\n')}
`;

  const summaryPath = path.join(backupsDir, 'backup_summary.md');
  fs.writeFileSync(summaryPath, summaryMarkdown, 'utf-8');

  console.log(`\n======================================================`);
  console.log(`🎉 Backup concluído com sucesso!`);
  console.log(`📁 Arquivo JSON: ${jsonPath}`);
  console.log(`📁 Arquivo SQL:  ${sqlPath}`);
  console.log(`📊 Total de Registros: ${totalRecords}`);
  console.log(`======================================================\n`);
}

runBackup().catch((err) => {
  console.error('❌ Falha fatal no script de backup:', err);
  process.exit(1);
});
