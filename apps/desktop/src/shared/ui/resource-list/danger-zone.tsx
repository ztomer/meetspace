import { Button } from "@meetspace/ui/components/ui/button";

export function DangerZone({
  title,
  description,
  buttonLabel,
  onAction,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="border-destructive/30 overflow-hidden rounded-lg border">
      <div className="border-destructive/30 bg-destructive-bg border-b px-4 py-3">
        <h3 className="text-destructive-fg text-sm font-semibold">
          Danger Zone
        </h3>
      </div>
      <div className="bg-background p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-foreground text-sm font-medium">{title}</p>
            <p className="text-muted-foreground mt-1 text-xs">{description}</p>
          </div>
          <Button onClick={onAction} variant="destructive" size="sm">
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
