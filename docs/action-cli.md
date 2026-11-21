# Offline project actions

Use `uv run youthumber --list-actions` to discover the current action catalog and
its OpenAI/Anthropic-compatible parameter schemas. This only prints local JSON;
it does not contact either service, start an HTTP server, or open a window.

`--run-actions` uses the same action engine as the existing local API. It accepts
an inline JSON array, a UTF-8 JSON file, or `-` for JSON on standard input:

```sh
printf '%s\n' '[{"action":"create_project","params":{"name":"Episode 42","speaker_count":2}},{"action":"set_headline","params":{"text":"A new episode"}}]' |
  uv run youthumber --run-actions - > project.json
```

To continue an existing project, provide an object with `actions` and `project`:

```json
{
  "project": {"id": "your-project-id", "text": {"text": "Old title"}},
  "actions": [
    {"action": "set_headline", "parameters": {"text": "New title"}}
  ]
}
```

The abbreviated project above illustrates the envelope only. Use the complete
project returned by the previous command to preserve speakers, layers and other
state. Save the envelope to `batch.json`, then run:

```sh
uv run youthumber --run-actions batch.json > updated-project.json
```

A step accepts `action` (or `name`) and `parameters` (or `params`). Supply only
one name key and one parameter key per step. If both aliases appear, the existing
engine prefers a non-empty `action` and non-empty `parameters`. Explicit null
parameter maps are rejected; omit them or use `{}` for no parameters. The batch
contains at most 100 steps, and the input is limited to 67,108,864 UTF-8 bytes.
An empty array keeps the initial project, or creates the engine's default project
when no initial project was supplied.

On success the command exits 0 and stdout contains one complete project as JSON.
On invalid input or a failed action it exits 2, leaves stdout empty and writes a
JSON error to stderr:

```json
{"error":{"code":"invalid_action_batch","message":"Batch object must contain an actions array"}}
```

This transport validates the batch envelope and step shapes, not the full saved
project format or every parameter against the discovery schemas. Existing action
semantics remain unchanged. Run only supported actions against a valid project.
The command does not overwrite its input file or write to the editor's IndexedDB;
use shell redirection to a different file and the editor's JSON import to load a
result. Do not redirect stdout to the same file used as input, since the shell
would truncate it before the command reads it.

This is project-state editing only. Headless image rendering/export, asynchronous
video/removal jobs, and full editor-command parity remain roadmap work.

Standard input is always decoded as UTF-8, independent of the terminal locale.
Output uses ASCII-safe JSON escapes while preserving the original text values.
The JSON error contract applies to action processing; command-line usage errors
(such as conflicting modes) use argparse's normal stderr help and exit code 2.

Existing readable paths may be regular files or process-substitution pipes. Reads
are bounded to 64 MiB, including embedded photos. Larger projects still need a
smaller project payload; the command does not silently strip or recompress images.
If an output consumer stops early, the command exits cleanly instead of printing
a broken-pipe traceback. That consumer is responsible for saving complete JSON.
