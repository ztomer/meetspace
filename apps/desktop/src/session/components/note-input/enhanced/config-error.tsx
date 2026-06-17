import { Trans } from "@lingui/react/macro";

import { Button } from "@meetspace/ui/components/ui/button";

import { useTabs } from "~/store/zustand/tabs";

export function ConfigError() {
  const openNew = useTabs((state) => state.openNew);

  return (
    <div
      role="alert"
      className="flex h-full min-h-[400px] flex-col items-center justify-center px-6"
    >
      <div className="mb-6 flex max-w-md flex-col gap-2 text-center">
        <p className="text-base font-medium">
          <Trans>Set up AI summaries</Trans>
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">
          <Trans>
            Start a Pro trial or add your own LLM API key to generate a summary
            from this transcript.
          </Trans>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          className="shadow-none"
          onClick={() =>
            openNew({ type: "settings", state: { tab: "account" } })
          }
        >
          <Trans>Get Pro</Trans>
        </Button>
        <Button
          variant="outline"
          className="shadow-none"
          onClick={() =>
            openNew({ type: "settings", state: { tab: "intelligence" } })
          }
        >
          <Trans>Add API key</Trans>
        </Button>
      </div>
    </div>
  );
}

function getMessageForStatus(status: LLMConnectionStatus): ReactNode {
  if (status.status === "pending" && status.reason === "missing_provider") {
    return (
      <Trans>
        You need to configure a language model to summarize this meeting
      </Trans>
    );
  }

  if (status.status === "pending" && status.reason === "missing_model") {
    return <Trans>You need to select a model to summarize this meeting</Trans>;
  }

  if (status.status === "error" && status.reason === "unauthenticated") {
    return <Trans>You need to sign in to use Meetspace's language model</Trans>;
  }

  if (status.status === "error" && status.reason === "not_pro") {
    return (
      <Trans>
        Your Meetspace plan has expired. Configure another language model or renew
        your plan
      </Trans>
    );
  }

  if (status.status === "error" && status.reason === "missing_config") {
    const missing = status.missing;
    if (missing.includes("api_key") && missing.includes("base_url")) {
      return (
        <Trans>
          You need to configure the API key and base URL for your language model
          provider
        </Trans>
      );
    }
    if (missing.includes("api_key")) {
      return (
        <Trans>
          You need to configure the API key for your language model provider
        </Trans>
      );
    }
    if (missing.includes("base_url")) {
      return (
        <Trans>
          You need to configure the base URL for your language model provider
        </Trans>
      );
    }
  }

  return (
    <Trans>
      You need to configure a language model to summarize this meeting
    </Trans>
  );
}


function getMessageForStatus(status: LLMConnectionStatus): ReactNode {
  if (status.status === "pending" && status.reason === "missing_provider") {
    return (
      <Trans>
        You need to configure a language model to summarize this meeting
      </Trans>
    );
  }

  if (status.status === "pending" && status.reason === "missing_model") {
    return <Trans>You need to select a model to summarize this meeting</Trans>;
  }

  if (status.status === "error" && status.reason === "unauthenticated") {
    return <Trans>You need to sign in to use Meetspace's language model</Trans>;
  }

  if (status.status === "error" && status.reason === "not_pro") {
    return (
      <Trans>
        Your Meetspace plan has expired. Configure another language model or renew
        your plan
      </Trans>
    );
  }

  if (status.status === "error" && status.reason === "unauthenticated") {
    return "You need to sign in to use Meetspace's language model";
  }

  if (status.status === "error" && status.reason === "not_pro") {
    return "Your Meetspace plan has expired. Configure another language model or renew your plan";
  }

  if (status.status === "error" && status.reason === "missing_config") {
    const missing = status.missing;
    if (missing.includes("api_key") && missing.includes("base_url")) {
      return (
        <Trans>
          You need to configure the API key and base URL for your language model
          provider
        </Trans>
      );
    }
    if (missing.includes("api_key")) {
      return (
        <Trans>
          You need to configure the API key for your language model provider
        </Trans>
      );
    }
    if (missing.includes("base_url")) {
      return (
        <Trans>
          You need to configure the base URL for your language model provider
        </Trans>
      );
    }
  }

  return (
    <Trans>
      You need to configure a language model to summarize this meeting
    </Trans>
  );
}
