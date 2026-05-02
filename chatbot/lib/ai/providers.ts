import { createOpenAI } from "@ai-sdk/openai";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import { titleModel } from "./models";

export const GROQ_CONFIGURATION_ERROR =
  "GROQ_API_KEY is required. Add it to chatbot/.env.local to send chat requests through Groq.";

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
        },
      });
    })()
  : null;

const groqProvider = process.env.GROQ_API_KEY
  ? createOpenAI({
      name: "groq",
      apiKey: process.env.GROQ_API_KEY,
      baseURL: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
    })
  : null;

function getGroqProvider() {
  if (!groqProvider) {
    throw new Error(GROQ_CONFIGURATION_ERROR);
  }

  return groqProvider;
}

export function assertGroqConfigured() {
  if (isTestEnvironment) {
    return;
  }

  getGroqProvider();
}

export function isGroqConfigurationError(error: unknown) {
  return (
    error instanceof Error && error.message.includes(GROQ_CONFIGURATION_ERROR)
  );
}

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  return getGroqProvider().languageModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }

  return getGroqProvider().languageModel(titleModel.id);
}
