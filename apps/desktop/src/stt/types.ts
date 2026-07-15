import type { SpeakerHintStorage, WordStorage } from "@meetspace/store";

export type WordWithId = WordStorage & { id: string };
export type SpeakerHintWithId = SpeakerHintStorage & { id: string };
