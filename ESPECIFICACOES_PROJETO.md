# Especificações Técnicas e Funcionais do Projeto — TutorNote APG

Este documento contém a especificação completa do sistema **TutorNote APG** (Acompanhamento Longitudinal e Avaliação de Sessões de Tutoria APG em Medicina). Ele foi estruturado para servir como referência direta na elaboração de suítes de testes automatizados (Testes Unitários, de Integração e End-to-End / E2E).

---

## 1. Visão Geral da Aplicação

O **TutorNote APG** é um sistema web progressivo voltado ao gerenciamento e avaliação do processo de Aprendizagem Baseada em Problemas (APG - Aprendizagem Pequenos Grupos) na educação médica.

### 1.1 Principais Objetivos
* Registrar a presença, papéis desempenhados (*Coordenador*, *Secretário*, *Membro*) e pontuações do barema de avaliação de tutoria APG.
* Permitir a avaliação estruturada através de rubricas e itens do barema por abertura, postura, fechamento e assiduidade.
* Gerenciar alunos, turmas, mesas de tutoria, SOIs (Sistemas Orgânicos Integrados) e semestres letivos.
* Permitir recomposição e alocação de mesas entre a 1ª Unidade (semanas 1 a 8) e a 2ª Unidade (semanas 9 a 20).
* Disponibilizar importação em lote via planilhas (Excel `.xlsx` / `.csv`) para alunos e casos APG com validação rigorosa de campos e duplicidades.
* Armazenar anotações pedagógicas por sessão no "Bloco de Notas da Mesa" e gerar relatórios longitudinais de desempenho dos estudantes.

---

## 2. Arquitetura Tecnológica e Camada de Dados

### 2.1 Tech Stack
* **Frontend Framework:** React 18 + Vite (TypeScript)
* **Estilização:** Tailwind CSS (Suporte a Dark Mode e temas responsivos)
* **Animações / UI:** Lucide React (Ícones), Motion/React (Animações de layout)
* **Gráficos e Visualizações:** Recharts, D3
* **Backend & Banco de Dados:** Supabase / PostgreSQL

### 2.2 Entidades e Tabelas do Banco de Dados (`public`)

| Tabela | Descrição | Principais Colunas / Chaves |
| :--- | :--- | :--- |
| `alunos` | Cadastro geral de estudantes | `id` (UUID), `nome`, `matricula`, `semestre_curso`, `ativo` (boolean) |
| `turmas` | Turmas cadastradas por semestre | `id` (UUID), `nome`, `semestre_id`, `professor_id`, `soi_id`, `curso`, `modulo` |
| `semestres` | Períodos letivos | `id` (UUID), `nome` (ex: 2026.1), `data_inicio`, `data_fim`, `ativo` |
| `sois` | Sistemas Orgânicos Integrados | `id` (UUID), `semestre_id`, `nome`, `codigo`, `ativo` |
| `mesas` | Grupos/Mesas de tutoria | `id` (UUID), `nome`, `turma_id`, `limite_estudantes` |
| `alocacoes_mesa` | Vínculo de alunos às mesas por unidade | `id` (UUID), `aluno_id`, `turma_id`, `mesa_id`, `unidade` (1 ou 2) |
| `casos_apg` | Casos pedagógicos para discussão APG | `id` (UUID), `soi_id`, `semestre_id`, `turma_id`, `semana` (1-20), `numero` (1 ou 2), `titulo`, `tema`, `descricao`, `objetivos`, `instrucoes_tutor` |
| `avaliacoes` | Notas e registros individuais de sessão | `id` (UUID), `aluno_id`, `turma_id`, `mesa_id`, `caso_id`, `semana`, `unidade`, `presenca`, `papel`, `barema_scores` (JSONB) |
| `bloco_notas_mesa` | Anotações coletivas da mesa na sessão | `id` (UUID), `turma_id`, `mesa_id`, `unidade`, `semana`, `observacoes`, `contribuicoes` (JSONB: `[{studentId, text}]`) |

---

## 3. Especificação Módulo a Módulo

### 3.1 Módulo de Autenticação e Navegação
* **Funcionalidade:** Permite o login de tutores/professores e controle de acesso baseado em papel (*Admin*, *Professor*, *Coordenador*).
* **Filtros Globais no Header:**
  * **Semestre:** Seleciona o semestre ativo (ex: `2026.1`, `2026.2` ou `Todos`).
  * **SOI (Sistema Orgânico Integrado):** Filtro por SOI ativo. Deve filtrar as turmas e casos compatíveis de forma resiliente. Se nenhuma turma corresponder ao SOI filtrado, o sistema aplica *fallback* gracioso mantendo as turmas do semestre visíveis.

### 3.2 Módulo de Avaliações (`EvaluationsPage.tsx`)
* **Fluxo Principal:**
  1. O tutor seleciona SOI, Semana/Caso, Turma, Mesa e Data da Sessão.
  2. A lista de estudantes alocados na mesa para a Unidade correspondente (1ª Unidade: semanas 1-8; 2ª Unidade: semanas 9-20) é exibida.
  3. Para cada aluno, o tutor registra:
     * **Presença:** `Presente`, `Ausente`, `Atestado`.
     * **Papel na Sessão:** `Coordenador`, `Secretário`, `Membro`.
     * **Notas dos Critérios:** Abertura, Postura, Fechamento e Assiduidade (com base na Rubrica Oficial APG).
  4. **Rubrica / Modal de Avaliação Individual:** Ao clicar no botão *Avaliar*, abre-se o modal contendo checkboxes dos critérios detalhados do barema com cálculo automático de nota.
  5. **Bloco de Notas da Mesa:**
     * Permite inserir anotações pedagógicas gerais da sessão.
     * Possui a seção **"Quem abordou cada ponto"**, composta por:
       * Dropdown para seleção de estudante (com fonte e fundo contrastantes tanto em modo claro quanto dark mode).
       * Input para o ponto de discussão.
       * Botão **Adicionar** e lista com botão **Remover** para cada item.

### 3.3 Módulo de Alunos (`StudentsPage.tsx` & `ImportStudentsModal.tsx`)
* **Cadastramento Individual:** Inclusão e edição de nome, matrícula, status (`Ativo`, `Trancado`, `Atenção`, `Inativo`) e semestre.
* **Importação em Lote de Alunos (Excel / CSV):**
  * Aceita arquivos `.xlsx`, `.xls` e `.csv`.
  * Realiza mapeamento flexível de cabeçalhos (`Nome`, `Matrícula/RA`, `Turma`, `Mesa U1`, `Mesa U2`, `Status`).
  * Valida matrículas duplicadas no arquivo e na base de dados.
  * Realiza alocação automática nas mesas informadas para a 1ª e 2ª unidades.

### 3.4 Módulo de Casos APG (`CasesPage.tsx` & `ImportCasesModal.tsx`)
* **Estrutura dos Casos:**
  * Cada caso possui Semana (1 a 20) e Problema (P1 ou P2).
  * A **Unidade** é calculada automaticamente: Semanas 1 a 8 = **1ª Unidade**; Semanas 9 a 20 = **2ª Unidade**.
* **Importação de Casos em Lote:**
  * Resolve o SOI correspondente via código, nome ou tokens em numerais romanos/arábicos (ex: "SOI 2", "SOI II", "soi_2").
  * Identifica e alerta sobre duplicidades na planilha e no banco de dados para a combinação SOI + Semana + Problema.

### 3.5 Módulo de Composição de Mesas (`TableCompositionPage.tsx` & `ClassesGroupsPage.tsx`)
* **Gestão de Turmas e Mesas:**
  * Criação de Turmas e definição do limite de alunos por Mesa (padrão: 10-12 estudantes por grupo).
  * Recomposição de mesas para a 2ª Unidade (rodízio pedagógico de alunos entre grupos).
  * Arrastar e soltar / Seleção de alunos para troca rápida de mesa.

### 3.6 Módulo de Relatórios e Desempenho (`ReportsPage.tsx`)
* **Análise Longitudinal:**
  * Gráfico de evolução de notas ao longo das semanas.
  * Gráfico de teia (Radar Chart) com desempenho por competência (Abertura, Postura, Fechamento, Assiduidade).
  * Exportação de síntese em PDF / Excel.

---

## 4. Guia e Matriz de Testes para Automação

Esta seção define os cenários e casos de testes indispensáveis para garantia de qualidade do software.

### 4.1 Testes Unitários (Unit Tests)

#### U01: Cálculo Automático da Unidade por Semana (`APGCase`)
* **Entrada:** `week = 5` $\rightarrow$ **Esperado:** `unit = 1`
* **Entrada:** `week = 8` $\rightarrow$ **Esperado:** `unit = 1`
* **Entrada:** `week = 9` $\rightarrow$ **Esperado:** `unit = 2`
* **Entrada:** `week = 20` $\rightarrow$ **Esperado:** `unit = 2`

#### U02: Resolução de Nomenclatura de SOI na Importação (`resolveSoiId`)
* **Entrada:** `"SOI II"` $\rightarrow$ Deve casar com o SOI cujo código/nome é "SOI 2" ou "SOI II".
* **Entrada:** `"soi_3"` $\rightarrow$ Deve casar com "SOI III".
* **Entrada:** String vazia $\rightarrow$ Retorna o SOI padrão fornecido no fallback.

#### U03: Cálculo da Pontuação do Barema
* **Entrada:** Critérios marcados totalizando 4.5 em Abertura, 5.0 em Postura, 4.5 em Fechamento, 2.0 em Assiduidade.
* **Saída:** Total = 16.0 / 20.0 pontos.

---

### 4.2 Testes de Integração (Integration Tests)

#### I01: Salvar Caso APG no Banco de Dados (`casos_apg`)
* **Ação:** Criar ou atualizar caso com as informações completas.
* **Verificação:** Garantir que a consulta de persistência via `upsert` não falhe por ausência de colunas legadas e retorne a linha cadastrada atualizada.

#### I02: Adicionar Contribuição no Bloco de Notas da Mesa
* **Ação:** Selecionar um aluno na lista `sessionStudents`, digitar a contribuição e clicar em "Adicionar".
* **Verificação:** O estado `notebookContributions` deve conter o objeto `{ studentId, text }` e renderizar o elemento visual correspondente.

#### I03: Filtragem Resiliente de Turmas por SOI e Semestre
* **Ação:** Alterar o filtro global de SOI para um SOI que não possui turmas cadastradas no semestre ativo.
* **Verificação:** A lista de turmas não deve ficar vazia de maneira destrutiva; deve retornar as turmas do semestre (fallback) sem quebrar o componente da interface.

---

### 4.3 Testes End-to-End (E2E) / Interface do Usuário

#### E01: Lançamento de Avaliação Completa de uma Sessão
1. Navegar até a página **Avaliações**.
2. Selecionar o SOI, Caso/Semana, Turma e Mesa.
3. Confirmar que a lista de alunos da mesa é carregada.
4. Alterar a presença de um aluno para "Presente", alterar papel para "Coordenador".
5. Clicar em "Avaliar", preencher as rubricas e salvar.
6. Verificar se o status da avaliação muda para "Concluído" com nota atualizada.

#### E02: Importação de Alunos via Planilha XLSX
1. Abrir o modal de **Importar Alunos**.
2. Fazer upload de um arquivo `.xlsx` válido contendo 10 alunos.
3. Verificar a pré-visualização das linhas, checando se não há erros de validação.
4. Clicar em "Confirmar Importação".
5. Confirmar que os alunos são visíveis na listagem da página **Alunos**.

#### E03: Preenchimento do Bloco de Notas da Mesa
1. Na tela de **Avaliações**, clicar em "Bloco de Notas da Mesa".
2. Digitar observações gerais da sessão.
3. Na seção "Quem abordou cada ponto", selecionar o aluno "Ana Clara Cruz Silva" no dropdown.
4. Digitar "Apresentou os mecanismos de neurotransmissão" e clicar em **Adicionar**.
5. Verificar se o item é adicionado com destaque visual adequado e contraste legível.
6. Clicar em "Salvar Anotações".

---

## 5. Requisitos Não-Funcionais e Acessibilidade
* **Contraste e Tema Dark/Light:** Todos os controles interativos (`<select>`, `<input>`, `<button>`) devem manter contraste de texto igual ou superior a WCAG AA (mínimo 4.5:1).
* **Tempo de Resposta:** Operações de busca, ordenação e troca de mesas devem responder em menos de 100ms no cliente.
* **Resiliência a Falhas de Conexão:** Operações que envolvem Supabase devem exibir toasts/mensagens amigáveis caso ocorra erro de rede.

---
*Documento gerado para a suite de validação e testes automatizados do TutorNote APG.*
