import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import { useMemo } from "react";

import type { CharTask } from "@hypr/api-client";
import type { AIProviderStorage } from "@hypr/store";

import { createTracedFetch, tracedFetch } from "../traced-fetch";

import { type ProviderId, PROVIDERS } from "~/settings/ai/llm/shared";
import { providerRowId } from "~/settings/ai/shared";
import {
  getProviderSelectionBlockers,
  type ProviderEligibilityContext,
} from "~/settings/ai/shared/eligibility";
import * as settings from "~/store/tinybase/store/settings";

type LanguageModelV3 = Parameters<typeof wrapLanguageModel>[0]["model"];

type LLMConnectionInfo = {
  providerId: ProviderId;
  modelId: string;
  baseUrl: string;
  apiKey: string;
};

export type LLMConnectionStatus =
  | { status: "pending"; reason: "missing_provider" }
  | { status: "pending"; reason: "missing_model"; providerId: ProviderId }
  | { status: "error"; reason: "provider_not_found"; providerId: string }
  | {
      status: "error";
      reason: "missing_config";
      providerId: ProviderId;
      missing: Array<"base_url" | "api_key">;
    }
  | { status: "success"; providerId: ProviderId; isHosted: false };

type LLMConnectionResult = {
  conn: LLMConnectionInfo | null;
  status: LLMConnectionStatus;
};

export const useLanguageModel = (task?: CharTask): LanguageModelV3 | null => {
  const { conn } = useLLMConnection();

  return useMemo(() => {
    if (!conn) return null;
    return createLanguageModel(conn, task);
  }, [conn, task]);
};

export const useLLMConnection = (): LLMConnectionResult => {
  const { current_llm_provider, current_llm_model } = settings.UI.useValues(
    settings.STORE_ID,
  );
  const providerConfig = settings.UI.useRow(
    "ai_providers",
    current_llm_provider ? providerRowId("llm", current_llm_provider) : "",
    settings.STORE_ID,
  ) as AIProviderStorage | undefined;

  return useMemo<LLMConnectionResult>(
    () =>
      resolveLLMConnection({
        providerId: current_llm_provider,
        modelId: current_llm_model,
        providerConfig,
      }),
    [current_llm_model, current_llm_provider, providerConfig],
  );
};

export const useLLMConnectionStatus = (): LLMConnectionStatus => {
  const { status } = useLLMConnection();
  return status;
};

const resolveLLMConnection = (params: {
  providerId: string | undefined;
  modelId: string | undefined;
  providerConfig: AIProviderStorage | undefined;
}): LLMConnectionResult => {
  const { providerId: rawProviderId, modelId, providerConfig } = params;

  if (!rawProviderId) {
    return {
      conn: null,
      status: { status: "pending", reason: "missing_provider" },
    };
  }

  const providerId = rawProviderId as ProviderId;

  if (!modelId) {
    return {
      conn: null,
      status: { status: "pending", reason: "missing_model", providerId },
    };
  }

  const providerDefinition = PROVIDERS.find((p) => p.id === rawProviderId);

  if (!providerDefinition) {
    return {
      conn: null,
      status: {
        status: "error",
        reason: "provider_not_found",
        providerId: rawProviderId,
      },
    };
  }

  const baseUrl =
    providerConfig?.base_url?.trim() ||
    providerDefinition.baseUrl?.trim() ||
    "";
  const apiKey = providerConfig?.api_key?.trim() || "";

  const context: ProviderEligibilityContext = {
    isAuthenticated: true,
    isPaid: true,
    config: { base_url: baseUrl, api_key: apiKey },
  };

  const blockers = getProviderSelectionBlockers(
    providerDefinition.requirements,
    context,
  );

  if (blockers.length > 0) {
    const blocker = blockers[0];
    if (blocker.code === "missing_config") {
      return {
        conn: null,
        status: {
          status: "error",
          reason: "missing_config",
          providerId,
          missing: blocker.fields,
        },
      };
    }
  }

  return {
    conn: { providerId, modelId, baseUrl, apiKey },
    status: { status: "success", providerId, isHosted: false },
  };
};


const wrapWithThinkingMiddleware = (
  model: LanguageModelV3,
): LanguageModelV3 => {
  return wrapLanguageModel({
    model,
    middleware: [
      extractReasoningMiddleware({ tagName: "think" }),
      extractReasoningMiddleware({ tagName: "thinking" }),
    ],
  });
};

const createLanguageModel = (
  conn: LLMConnectionInfo,
  task?: CharTask,
): LanguageModelV3 => {
  const traced = task ? createTracedFetch(task) : tracedFetch;

  // Ollama needs the Origin header set explicitly; otherwise its CORS check
  // rejects requests from non-browser callers.
  const isOllama = conn.providerId === "ollama";
  const fetchImpl: typeof fetch = isOllama
    ? async (input, init) => {
        const ollamaOrigin = new URL(
          conn.baseUrl.replace(/\/v1\/?$/, ""),
        ).origin;
        const headers = new Headers(init?.headers);
        headers.set("Origin", ollamaOrigin);
        return tauriFetch(input as RequestInfo | URL, { ...init, headers });
      }
    : traced;

  const config: Parameters<typeof createOpenAICompatible>[0] = {
    fetch: fetchImpl,
    name: conn.providerId,
    baseURL: conn.baseUrl,
  };
  if (conn.apiKey) {
    config.apiKey = conn.apiKey;
  }
  const provider = createOpenAICompatible(config);
  return wrapWithThinkingMiddleware(provider.chatModel(conn.modelId));
};
