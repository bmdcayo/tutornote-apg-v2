import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Uploads the latest backup files to Google Drive
 * Supports:
 *  1. Service Account JSON key (GDRIVE_SERVICE_ACCOUNT_KEY)
 *  2. OAuth Refresh Token (GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN)
 */

interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
}

function base64UrlEncode(str: string | Buffer): string {
  const base64 = typeof str === 'string' ? Buffer.from(str).toString('base64') : str.toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessTokenFromServiceAccount(sa: GoogleServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(sa.private_key);
  const jwt = `${signatureInput}.${base64UrlEncode(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Falha ao obter token da Service Account: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function getAccessTokenFromRefreshToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Falha ao renovar token OAuth do Google: ${JSON.stringify(data)}`);
  }

  return data.access_token;
}

async function uploadFileToDrive(
  accessToken: string,
  filePath: string,
  fileName: string,
  folderId?: string,
  shareWithEmail?: string
): Promise<{ fileId: string; name: string }> {
  const fileContent = fs.readFileSync(filePath);
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata: Record<string, any> = {
    name: fileName,
    mimeType: fileName.endsWith('.json') ? 'application/json' : 'text/plain',
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const multipartRequestBody = Buffer.concat([
    Buffer.from(
      delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        `Content-Type: ${metadata.mimeType}\r\n\r\n`
    ),
    fileContent,
    Buffer.from(closeDelimiter),
  ]);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok || !uploadData.id) {
    throw new Error(`Erro no upload para o Google Drive: ${JSON.stringify(uploadData)}`);
  }

  const fileId = uploadData.id;

  // If sharing with user email is requested (e.g. bmdcayo@gmail.com)
  if (shareWithEmail) {
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'writer',
          type: 'user',
          emailAddress: shareWithEmail,
        }),
      });
      console.log(`✉️ Arquivo compartilhado com permissão para: ${shareWithEmail}`);
    } catch (shareErr) {
      console.warn('⚠️ Não foi possível compartilhar permissão individual do arquivo:', shareErr);
    }
  }

  return { fileId, name: fileName };
}

async function runDriveUpload() {
  console.log(`\n======================================================`);
  console.log(`☁️ Iniciando Envio do Backup para o Google Drive`);
  console.log(`======================================================\n`);

  const backupsDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupsDir)) {
    console.log('⚠️ Nenhuma pasta de backups encontrada. Pulando upload do Google Drive.');
    return;
  }

  // Find newest .json and .sql files in backups directory
  const files = fs.readdirSync(backupsDir);
  const backupFiles = files
    .filter((f) => f.startsWith('tutornote_backup_') && (f.endsWith('.json') || f.endsWith('.sql')))
    .sort()
    .reverse();

  if (backupFiles.length === 0) {
    console.log('⚠️ Nenhum arquivo de snapshot encontrado em ./backups. Pulando upload.');
    return;
  }

  // Get up to 2 latest files (JSON + SQL)
  const filesToUpload = backupFiles.slice(0, 2);

  // Authenticate
  let accessToken = '';
  const saKeyRaw = process.env.GDRIVE_SERVICE_ACCOUNT_KEY;
  const clientId = process.env.GDRIVE_CLIENT_ID;
  const clientSecret = process.env.GDRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GDRIVE_REFRESH_TOKEN;
  const folderId = process.env.GDRIVE_FOLDER_ID;
  const backupEmail = process.env.GDRIVE_BACKUP_EMAIL || 'bmdcayo@gmail.com';

  if (saKeyRaw) {
    try {
      let saJson: GoogleServiceAccount;
      const cleanKey = saKeyRaw.trim();
      if (cleanKey.startsWith('{') && cleanKey.endsWith('}')) {
        saJson = JSON.parse(cleanKey);
      } else if (cleanKey.startsWith('{')) {
        saJson = JSON.parse(cleanKey);
      } else {
        // Might be base64 encoded or have surrounding quotes
        let candidate = cleanKey;
        if (candidate.startsWith('"') && candidate.endsWith('"')) {
          candidate = candidate.slice(1, -1);
        }
        try {
          const decoded = Buffer.from(candidate, 'base64').toString('utf-8');
          if (decoded.trim().startsWith('{')) {
            saJson = JSON.parse(decoded);
          } else {
            throw new Error('Conteúdo não é JSON nem Base64 de JSON');
          }
        } catch {
          saJson = JSON.parse(candidate);
        }
      }

      if (!saJson.client_email || !saJson.private_key) {
        throw new Error(
          'O JSON da Service Account precisa conter os campos "client_email" e "private_key". Verifique o conteúdo do Secret GDRIVE_SERVICE_ACCOUNT_KEY.'
        );
      }

      accessToken = await getAccessTokenFromServiceAccount(saJson);
      console.log('✅ Autenticado com Google Drive via Service Account.');
    } catch (err: any) {
      console.error('❌ Erro na autenticação com Service Account do Google Drive:', err.message);
      console.error('👉 Dica: Certifique-se de que copiou TODO o texto do arquivo .json baixado no Google Cloud (incluindo as chaves { e }).');
      process.exit(1);
    }
  } else if (clientId && clientSecret && refreshToken) {
    try {
      accessToken = await getAccessTokenFromRefreshToken(clientId, clientSecret, refreshToken);
      console.log('✅ Autenticado com Google Drive via OAuth Refresh Token.');
    } catch (err: any) {
      console.error('❌ Erro na autenticação OAuth com Google Drive:', err.message);
      process.exit(1);
    }
  } else {
    console.log(
      'ℹ️ [AVISO] Segredos do Google Drive (GDRIVE_SERVICE_ACCOUNT_KEY ou GDRIVE_REFRESH_TOKEN) não configurados ainda.'
    );
    console.log('👉 O backup foi salvo com segurança no repositório GitHub e nos Artefatos de Execução.');
    console.log('👉 Consulte o arquivo GUIA_BACKUP_AUTOMATIZADO.md para ativar o envio automático para o Google Drive.\n');
    return;
  }

  for (const fileName of filesToUpload) {
    const fullPath = path.join(backupsDir, fileName);
    process.stdout.write(`📤 Enviando '${fileName}' para o Google Drive... `);
    try {
      const res = await uploadFileToDrive(accessToken, fullPath, fileName, folderId, backupEmail);
      console.log(`✅ Concluído! (ID: ${res.fileId})`);
    } catch (uploadErr: any) {
      console.log(`❌ Erro: ${uploadErr.message}`);
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 Processo de upload para o Google Drive finalizado!`);
  console.log(`======================================================\n`);
}

runDriveUpload().catch((err) => {
  console.error('❌ Erro inesperado no upload para o Google Drive:', err);
});
