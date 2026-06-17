/**
 * Locally-inlined types that used to come from `@meetspace/api-client`
 * (itself a frozen progenitor-generated artifact from upstream's deleted
 * `apps/api/openapi.gen.json`).
 *
 * Only the surface our remaining call sites actually consume is preserved
 * — anything else from the upstream OpenAPI spec is gone.
 */

/**
 * A connection registered by an OAuth-based integration (Google Calendar,
 * Outlook, etc.). Historically came back from the upstream Nango proxy; in
 * the local-only fork we don't have remote connections, so `useConnections`
 * returns an empty array of these to satisfy callers.
 */
export type ConnectionItem = {
  connection_id: string;
  integration_id: string;
  last_error_at?: string | null;
  last_error_description?: string | null;
  last_error_type?: string | null;
  status?: string | null;
  updated_at?: string | null;
};

/** Task tag passed to `useLanguageModel` so tracing can attribute requests. */
export type CharTask = "chat" | "enhance" | "title";
