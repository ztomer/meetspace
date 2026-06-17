import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

export type LinearIssueInput = {
  apiKey: string;
  /** Linear team UUID. */
  teamId: string;
  title: string;
  description?: string;
};

type LinearGraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

async function linearGraphQL<T>(
  apiKey: string,
  query: string,
  variables: unknown,
): Promise<T> {
  const res = await tauriFetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linear API ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as LinearGraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(`Linear: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) {
    throw new Error("Linear returned no data");
  }
  return json.data;
}

export type LinearTeam = { id: string; name: string; key: string };

/** Fetch the user's teams. Used to populate the team picker. */
export async function listLinearTeams(apiKey: string): Promise<LinearTeam[]> {
  const query = `query { teams(first: 50) { nodes { id name key } } }`;
  const data = await linearGraphQL<{ teams: { nodes: LinearTeam[] } }>(
    apiKey,
    query,
    {},
  );
  return data.teams.nodes;
}

/** Create a Linear issue. Returns the issue URL. */
export async function createLinearIssue(
  input: LinearIssueInput,
): Promise<{ issueUrl: string; identifier: string }> {
  if (!input.apiKey) throw new Error("Linear API key is not configured");
  if (!input.teamId) throw new Error("Linear team is not configured");

  const query = `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url }
      }
    }
  `;
  const data = await linearGraphQL<{
    issueCreate: {
      success: boolean;
      issue: { id: string; identifier: string; url: string };
    };
  }>(input.apiKey, query, {
    input: {
      teamId: input.teamId,
      title: input.title,
      description: input.description ?? "",
    },
  });
  if (!data.issueCreate.success) {
    throw new Error("Linear refused to create the issue");
  }
  return {
    issueUrl: data.issueCreate.issue.url,
    identifier: data.issueCreate.issue.identifier,
  };
}
