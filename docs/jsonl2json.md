# jsonl2json Utility

`src/utils/jsonl2json.js` converts a `.jsonl` file to a formatted `.json` file.

This utility was added in preparation for reporting features that inspect what is being done in Codex sessions. It also has standalone value for converting Codex session files from JSONL to JSON, which can then be formatted, searched, and parsed by other tooling.

## Usage

Run the utility with Node.js:

```bash
node src/utils/jsonl2json.js path/to/file.jsonl
```

By default, the output file is written next to the input file with the same basename and a `.json` extension.

An output folder can be provided:

```bash
node src/utils/jsonl2json.js path/to/file.jsonl /tmp/session-json
```

An explicit output file can also be provided:

```bash
node src/utils/jsonl2json.js path/to/file.jsonl /tmp/session-json/session.json
```

## Output Format

The generated JSON file contains one top-level `items` array. Each non-empty JSONL line becomes one item in that array.

```json
{
    "items": []
}
```

The output is formatted with two-space indentation and a trailing newline.

## Validation

The input file must use the `.jsonl` extension. Empty lines are ignored. If a non-empty line contains invalid JSON, the utility stops and reports the input file and line number.
