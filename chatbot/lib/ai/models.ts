export const DEFAULT_CHAT_MODEL = "llama-3.3-70b-versatile";

export const titleModel = {
  id: DEFAULT_CHAT_MODEL,
  name: "Llama 3.3 70B Versatile",
  provider: "groq",
  description: "Default model for title generation",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B Versatile",
    provider: "groq",
    description: "Groq-hosted Llama 3.3 70B model",
  },
];

export const modelCapabilities: Record<string, ModelCapabilities> = {
  "llama-3.3-70b-versatile": {
    tools: true,
    vision: false,
    reasoning: false,
  },
};

export function getCapabilities(): Record<string, ModelCapabilities> {
  return Object.fromEntries(
    chatModels.map((model) => [
      model.id,
      modelCapabilities[model.id] ?? {
        tools: false,
        vision: false,
        reasoning: false,
      },
    ])
  );
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
