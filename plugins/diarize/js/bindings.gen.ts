// @ts-nocheck
import { invoke as TAURI_INVOKE } from "@tauri-apps/api/core";

export const commands = {
  async diarizeAudio(
    audioPath: string,
  ): Promise<Result<SpeakerTurn[], string>> {
    try {
      return {
        status: "ok",
        data: await TAURI_INVOKE("plugin:diarize|diarize_audio", { audioPath }),
      };
    } catch (e) {
      if (e instanceof Error) throw e;
      else return { status: "error", error: e as any };
    }
  },
};

export type SpeakerTurn = {
  startMs: number;
  endMs: number;
  speakerIndex: number;
};

export type Result<T, E> =
  | { status: "ok"; data: T }
  | { status: "error"; error: E };
