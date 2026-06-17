import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";

import { dismissInstruction } from "@meetspace/plugin-windows";

import { InstructionScreen, type InstructionType } from "~/instruction";

export const Route = createFileRoute("/app/instruction")({
  validateSearch: (search): { type: InstructionType; url?: string } => ({
    type: ((search as { type?: string }).type ??
      "integration") as InstructionType,
    url: (search as { url?: string }).url,
  }),
  component: InstructionRoute,
});

function InstructionRoute() {
  const { type, url } = Route.useSearch();
  const onBack = useCallback(() => void dismissInstruction(), []);

  return <InstructionScreen type={type} url={url} onBack={onBack} />;
}
