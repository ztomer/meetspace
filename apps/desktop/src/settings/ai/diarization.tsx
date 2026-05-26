import { Switch } from "@meetspace/ui/components/ui/switch";

import { useConfigValues } from "~/shared/config";
import * as settings from "~/store/tinybase/store/settings";

/**
 * Toggle for local Pyannote speaker diarization. Off by default — the
 * full pipeline (segmentation + per-segment embedding + cosine clustering)
 * runs in-process after each capture and adds noticeable CPU spend per
 * minute of audio. When on, speaker turns get merged into
 * `transcripts.speaker_hints` and the existing `SpeakerLabelManager` UI
 * lights up with `Speaker 1 / Speaker 2 / …` labels automatically.
 */
export function DiarizationSetting() {
  const { diarize_auto } = useConfigValues(["diarize_auto"] as const);
  const setDiarizeAuto = settings.UI.useSetValueCallback(
    "diarize_auto",
    (v: boolean) => v,
    [],
    settings.STORE_ID,
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-md font-sans font-semibold">Speaker diarization</h2>
      <div className="border-border flex items-center justify-between gap-4 rounded-lg border p-4">
        <div className="flex-1">
          <h3 className="mb-1 text-sm font-medium">
            Detect speakers after each meeting
          </h3>
          <p className="text-muted-foreground text-xs">
            Runs a local Pyannote model on the saved audio when a session ends
            and tags transcript segments with Speaker 1 / Speaker 2 / … labels.
            Adds CPU work per meeting; safe to leave off if you only record
            yourself.
          </p>
        </div>
        <Switch
          checked={diarize_auto ?? false}
          onCheckedChange={(checked) => setDiarizeAuto(checked)}
        />
      </div>
    </section>
  );
}
