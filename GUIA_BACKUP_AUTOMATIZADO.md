# 🛡️ Guia de Backup Automático da Base de Dados (TutorNote APG)

Este projeto conta com uma rotina de **Backup Automático programada via GitHub Actions** que extrai todos os dados do banco de dados (Supabase), salva o histórico no próprio GitHub e envia cópias de segurança para o seu **Google Drive (`bmdcayo@gmail.com`)**.

---

## ⏰ 1. Frequência e Horários de Execução

- **Dias da semana:** **Terças-feiras** e **Sextas-feiras**
- **Horário:** **14:00 (Horário de Brasília)** — *(17:00 UTC no GitHub Actions)*
- **Disparo Manual:** A qualquer momento, você pode ir na aba **Actions** do seu repositório no GitHub, clicar no workflow **"Backup Automático da Base de Dados"** e selecionar **"Run workflow"**.

---

## 📂 2. Onde os Arquivos Ficam Salvos?

A cada execução, o sistema gera dois formatos de arquivo com carimbo de data e hora (exemplo: `tutornote_backup_2026-08-16_14-00-00`):
1. **Arquivo `.json`:** Snapshot estruturado contendo metadados, contagem de registros e todos os dados de todas as tabelas.
2. **Arquivo `.sql`:** Script SQL com instruções `INSERT INTO` pronto para restaurar o banco de dados em segundos se necessário.

Os backups são armazenados em 3 locais:
- 📁 **Pasta `/backups` no GitHub:** Salvo no histórico do repositório (`git commit`).
- 📎 **Aba *Actions > Artifacts* no GitHub:** Disponível para download direto por até 90 dias.
- ☁️ **Google Drive (`bmdcayo@gmail.com`):** Enviado para o seu Drive conectado.

---

## 🔐 3. Configuração dos Segredos (GitHub Secrets)

Para que a automação tenha permissão de consultar o Supabase e enviar os arquivos para o seu Google Drive, adicione as seguintes variáveis no seu repositório do GitHub em:
👉 **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### A) Credenciais do Supabase (Obrigatórias)
| Nome do Secret | Onde encontrar no Supabase | Descrição |
| :--- | :--- | :--- |
| `SUPABASE_URL` | *Project Settings > API > Project URL* | URL do seu projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | *Project Settings > API > `service_role` secret* | Chave de serviço com permissão de leitura completa de todas as tabelas |

---

### B) Credenciais do Google Drive (Para envio automático ao `bmdcayo@gmail.com`)

Existem duas formas simples de conectar o Google Drive:

#### Opção Recomendada: Google Cloud Service Account (Mais simples e estável)
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um projeto (ou use um existente) e ative a **Google Drive API**.
3. Vá em **IAM & Admin > Service Accounts** e crie uma conta de serviço (ex.: `tutornote-backup-bot`).
4. Clique na conta criada, vá na aba **Keys (Chaves)** → **Add Key** → **Create new key (JSON)**. O arquivo `.json` será baixado.
5. Crie uma pasta no seu Google Drive (ex: `Backups TutorNote`) e compartilhe essa pasta com o e-mail da Service Account gerada (como *Editor*).
6. No GitHub, adicione os seguintes Secrets:
   - `GDRIVE_SERVICE_ACCOUNT_KEY`: Cole todo o conteúdo do arquivo `.json` baixado.
   - `GDRIVE_FOLDER_ID` *(Opcional)*: O ID da pasta do Google Drive (o código que aparece no final da URL da pasta).
   - `GDRIVE_BACKUP_EMAIL`: `bmdcayo@gmail.com`

---

## 🗃️ 4. Tabelas Incluídas no Backup

O backup realiza a extração completa das seguintes tabelas:
- `semestres` (Configuração de semestres letivos)
- `sois` (Sistemas Orgânicos Integrados)
- `turmas` (Turmas cadastradas)
- `mesas` (Mesas de tutoria)
- `alunos` (Lista de estudantes, matrículas, status)
- `alocacoes_mesa` (Alocações semanais e por unidade)
- `historico_alocacoes_mesa` (Histórico de rotações e papéis)
- `contribuicao_estudantes` (Registros de contribuição)
- `casos_apg` (Problemas P1 e P2 de todas as semanas)
- `avaliacoes` (Notas dos 4 domínios, **ajustes docentes (+/-)**, justificativas e assiduidade)
- `anotacoes_mesa` (Anotações do tutor)
- `configuracoes` (Pesos de avaliação, baremas e configurações do sistema)
- `profiles` (Perfis de docentes e permissões)

---

## 🔄 5. Como Restaurar um Backup em Caso de Emergência

1. **Via SQL no Supabase:**
   - Acesse o Supabase Dashboard do seu projeto.
   - Vá em **SQL Editor**.
   - Abra o arquivo `tutornote_backup_AAAA-MM-DD.sql` gerado pelo backup, cole o conteúdo e clique em **Run**.
2. **Via JSON:**
   - Os dados estão em formato JSON puro estruturado por tabela (`tables.<nome_da_tabela>.records`), prontos para importação via script ou API.
