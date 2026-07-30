# TutorNote APG — atualização funcional

## 1. Atualize o banco antes de abrir a nova versão

No Supabase, abra **SQL Editor**, copie todo o conteúdo de:

`supabase/migrations/20260730_release_readiness.sql`

e clique em **Run** uma única vez.

Essa migração adiciona:

- persistência dos casos SxxP1 e SxxP2;
- persistência das avaliações;
- configurações do Barema;
- bloco de notas por turma, caso e mesa;
- campos e políticas da segunda chamada;
- Row Level Security para os dados acadêmicos.

## 2. Variáveis necessárias no AI Studio

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `GEMINI_API_KEY`
- `VITE_ENABLE_DEMO_MODE=false`

## 3. Fluxo do atestado e da segunda chamada

1. Na avaliação original, selecione **Atestado (2ª chamada)**.
2. O registro fica como **Pendente de 2ª chamada**, sem nota abonada e sem receber zero automático.
3. A notificação identifica estudante, data da falta e caso (por exemplo, `S02P1`).
4. O relatório **Ausências/Atestados (XLSX)** apresenta a pendência e a data do caso.
5. Na reposição, abra a mesma avaliação, marque **Presente**, informe a nota e conclua.
6. O sistema grava a data da segunda chamada, encerra a pendência e inclui a nota na média.

## 4. Validações executadas

- `npm run lint`: aprovado.
- `npm run build`: aprovado.
- auditoria do cálculo: 12 de 12 testes aprovados.

## 5. Composição das mesas

- A 1ª e a 2ª unidade exibem o botão de salvamento.
- O botão informa explicitamente qual unidade será salva.
- O sistema confere no Supabase se cada alteração foi realmente gravada.
- Falhas de sessão, permissão, RLS ou banco são exibidas na própria tela.
- A mensagem de sucesso só aparece depois da confirmação dos registros.
