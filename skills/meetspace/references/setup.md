# Setup

## MCP

Run the local stdio server with:

```bash
meetspace mcp
```

A generic client configuration is:

```json
{
  "mcpServers": {
    "meetspace": {
      "command": "meetspace",
      "args": ["mcp"]
    }
  }
}
```

Restart the client after changing its MCP configuration.

## CLI

The CLI currently installs from source:

```bash
git clone https://github.com/fastrepl/meetspace.git
cd meetspace
cargo install --locked --path apps/cli
meetspace --version
```

Run the Meetspace desktop app at least once so its local database exists. Homebrew, desktop-bundled, and Windows binary distribution are planned but not yet available.

Use `--db-path FILE` or `MEETSPACE_DB_PATH` only when the database is outside Meetspace's default application-data location.
