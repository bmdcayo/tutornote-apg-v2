import express from "express";
import path from "path";
import * as fs from "fs";
import { GoogleGenAI } from "@google/genai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  // Centralized Supabase server client getter
  let supabaseServerClient: SupabaseClient | null = null;
  function getSupabaseClient(): { client: SupabaseClient | null; errorMsg?: string } {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl && !supabaseKey) {
      return {
        client: null,
        errorMsg: "As variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY estão ausentes no servidor.",
      };
    }
    if (!supabaseUrl) {
      return {
        client: null,
        errorMsg: "A variável de ambiente VITE_SUPABASE_URL está ausente no servidor.",
      };
    }
    if (!supabaseKey) {
      return {
        client: null,
        errorMsg: "A variável de ambiente VITE_SUPABASE_PUBLISHABLE_KEY está ausente no servidor.",
      };
    }

    if (!supabaseServerClient) {
      try {
        supabaseServerClient = createClient(supabaseUrl, supabaseKey);
      } catch (err) {
        return {
          client: null,
          errorMsg: "Falha ao inicializar o cliente do Supabase com as credenciais configuradas.",
        };
      }
    }
    return { client: supabaseServerClient };
  }

  // Initialize Gemini client lazily
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY não configurada no servidor.");
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return aiClient;
  }

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "TutorNote APG API" });
  });

  // Safe Supabase Connection Test Endpoint
  app.get("/api/supabase/test", async (_req, res) => {
    try {
      const { client, errorMsg } = getSupabaseClient();
      if (!client || errorMsg) {
        return res.status(200).json({
          success: false,
          connected: false,
          message: errorMsg || "Credenciais do Supabase não configuradas no servidor.",
        });
      }

      // Query table 'semestres'
      const { data, error } = await client.from("semestres").select("*").limit(1);

      if (error) {
        const errorText = (error.message || "").toLowerCase();
        const errorDetails = (error.details || "").toLowerCase();
        const errorCode = error.code;

        // Check if table 'semestres' does not exist
        if (
          errorCode === "42P01" ||
          errorCode === "PGRST204" ||
          errorCode === "PGRST200" ||
          errorText.includes("does not exist") ||
          errorText.includes("not found") ||
          errorDetails.includes("does not exist") ||
          errorText.includes("semestres")
        ) {
          return res.status(200).json({
            success: false,
            connected: false,
            tableExists: false,
            message: 'A tabela "semestres" não foi encontrada no banco de dados Supabase.',
          });
        }

        return res.status(200).json({
          success: false,
          connected: false,
          message: "Erro ao consultar a tabela 'semestres' no Supabase.",
        });
      }

      // Success
      return res.status(200).json({
        success: true,
        connected: true,
        tableExists: true,
        message: "Conexão com Supabase estabelecida",
      });
    } catch (err: any) {
      return res.status(200).json({
        success: false,
        connected: false,
        message: "Erro interno ao testar conexão com o Supabase.",
      });
    }
  });

  // Endpoint to generate pedagogical feedback using Gemini API
  app.post("/api/gemini/feedback", async (req, res) => {
    try {
      const {
        caseTitle,
        caseObjectives,
        week,
        unit,
        role,
        scores,
        tags,
        teacherNotes,
      } = req.body;

      const ai = getGeminiClient();

      const objectivesFormatted =
        Array.isArray(caseObjectives) && caseObjectives.length > 0
          ? caseObjectives.join("; ")
          : "Objetivos do caso de APG correspondente";

      const scoresFormatted = Array.isArray(scores)
        ? scores.map((s: any) => `${s.name}: ${s.score}/${s.max}`).join("; ")
        : "Critérios do Barema avaliados";

      const tagsFormatted =
        Array.isArray(tags) && tags.length > 0
          ? tags.join(", ")
          : "Nenhuma tag atribuída";

      const prompt = `Você é um tutor acadêmico especialista na metodologia de Aprendizagem em Pequenos Grupos (APG) em faculdade de Medicina.
Sua função é elaborar um parecer pedagógico individualizado, construtivo e estritamente acadêmico em Português do Brasil (pt-BR) com base nos dados brutos da sessão.

DADOS DA SESSÃO:
- Caso APG: "${caseTitle || "Caso APG"}"
- Objetivos do Caso: "${objectivesFormatted}"
- Semana: ${week || 1} | Unidade: ${unit || 1}
- Papel na Sessão: ${role || "Membro"}
- Pontuações dos Critérios do Barema: ${scoresFormatted}
- Tags de Desempenho Atribuídas: ${tagsFormatted}
- Observações Privadas do Professor: "${teacherNotes || "Sem observações adicionais"}"

DIRETRIZES E OBRIGAÇÕES PARA O PARECER:
1. O parecer DEVE conter exatamente 4 seções organizadas nos seguintes tópicos numerados:
   1. Síntese do desempenho
   2. Pontos fortes
   3. Oportunidades de melhoria
   4. Orientação para a próxima sessão

2. Mantenha o tamanho total do texto entre 100 e 180 palavras.
3. Utilize linguagem acadêmica, formal, respeitosa e construtiva.
4. NUNCA invente informações não fornecidas nos dados da sessão.
5. NUNCA faça diagnósticos médicos, psicológicos, comportamentais ou educacionais.
6. NUNCA declare aprovação ou reprovação do discente.
7. NUNCA calcule ou altere notas; as notas são gerenciadas exclusivamente pelo sistema matemático.
8. Trate o discente de forma impessoal ("O(A) estudante" ou "O discente"), sem utilizar nomes, matrículas ou e-mails.

Escreva o parecer completo com os 4 tópicos:`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          temperature: 0.5,
        },
      });

      const feedbackText = response.text || "Não foi possível gerar o parecer no momento.";
      res.json({ success: true, feedback: feedbackText });
    } catch (error: any) {
      console.error("Erro ao gerar parecer com Gemini:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Erro interno ao processar inteligência artificial.",
      });
    }
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor TutorNote APG rodando na porta http://localhost:${PORT}`);
  });
}

startServer();
