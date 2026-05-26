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
    <div className="overflow-hidden rounded-lg border border-destructive/30">
      <div className="border-b border-destructive/30 bg-red-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-red-900">Danger Zone</h3>
      </div>
      <div className="bg-background p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
          <Button onClick={onAction} variant="destructive" size="sm">
            {buttonLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
