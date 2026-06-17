// @ts-nocheck
// Auto-generated. Run `cargo test -p tauri-plugin-oauth export_types` to refresh.

import { invoke as TAURI_INVOKE } from "@tauri-apps/api/core";

export const commands = {
  async startPkceFlow(args: StartPkceFlowArgs): Promise<Result<PkceTokens, string>> {
    try {
      return {
        status: "ok",
        data: await TAURI_INVOKE("plugin:oauth|start_pkce_flow", { args }),
      };
    } catch (e) {
      if (e instanceof Error) throw e;
      else return { status: "error", error: e as any };
    }
  },
};

export type StartPkceFlowArgs = {
  provider: string;
  clientId: string;
  scopes: string;
  authorizeUrl: string;
  tokenUrl: string;
  extraAuthorizeParams?: Record<string, string>;
  timeoutSeconds?: number;
};

export type PkceTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  tokenType: string | null;
  scope: string | null;
};

export type Result<T, E> =
  | { status: "ok"; data: T }
  | { status: "error"; error: E };
