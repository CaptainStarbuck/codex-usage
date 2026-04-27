# Source Aggregate

## Purpose

`src/aggregate.js` builds `src/aggregate.md`, a markdown document that contains every JavaScript source file in `src`.

## File Order

The aggregate document places files in this order:

- `codex-usage.js`
- `constants.js`
- Remaining `.js` files in alphabetical order

## Format

Each source file is rendered as a markdown section with the file name as the heading, a short source file description, and a JavaScript code block containing the full file contents.

## Command

Run the utility from the project root:

```bash
node src/aggregate.js
```
