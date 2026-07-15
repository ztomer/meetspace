# CLI commands

Use `--json` for agent-readable output.

```bash
meetspace --json doctor
meetspace --json meetings list --query "planning" --limit 20 --offset 0
meetspace --json meetings get MEETING_ID
meetspace --json meetings note MEETING_ID --kind note
meetspace --json meetings note MEETING_ID --kind summary
meetspace --json meetings history MEETING_ID --limit 20 --offset 0
```

`doctor` exits with status 1 when its response contains `ready: false`.

Read transcripts in bounded word pages:

```bash
meetspace --json meetings transcript MEETING_ID --limit 200 --offset 0
```

JSON success responses contain `schema_version`, `command`, `data`, and optional `pagination`. Continue from `pagination.next_offset` only when more context is necessary.

Export is intended for an explicit user request to save or transfer a complete meeting:

```bash
meetspace meetings export MEETING_ID --format markdown --output meeting.md
meetspace meetings export MEETING_ID --format json --output meeting.json
```

Export refuses to replace an existing file. Pass `--force` only after the user explicitly approves overwriting that exact path.

Global database overrides:

```bash
meetspace --db-path /path/to/app.db --json meetings list
meetspace --base /path/to/meetspace-data --json meetings list
```
