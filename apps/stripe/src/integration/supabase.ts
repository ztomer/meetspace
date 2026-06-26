import { createClient } from "@meetspace/supabase";

import { env } from "../env";

export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);
