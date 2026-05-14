# Project

**This is the only AGENTS.md file in the project, do not look for others.**

See README.md for information about this software called Codex Usage.

# Codex Task Management

## Documentation

### `README.md`

- Describes the project for users, not for project contributors.
- Includes "what it does", not "how it works".
- Do not put code-level information in the README, only user-facing functionality information.
- Contact information in this README.md file is intentional and acceptable, do not remove.

### `CHANGELOG.md`

- Describes functionality relevant to users, not for project contributors.
- Use `docs/DEVELOPER_CHANGELOG.md` to document code-level changes.
- Balance information between the files: CHANGELOG.md only describes user-facing features that have changed, DEVELOPER_CHANGELOG.md describes all code changes, new documentation, refactorings, dependency changes, scripts and utilities, test code and documentation.

All changelog updates are added to the bottom of the current date/version section, not at the top.

Use the local date/time for output, not UTC.

### `docs` folder

In this project the `docs` folder is intended for project contributors. It describes how things work and where in the code the functionality is implemented. `docs` files contain the enduring reference material to events noted in DEVELOPER_CHANGELOG.md and CHANGELOG.md.

Do not run src/aggregate.js to generate docs/aggregate.md unless explicitly instructed.

## Linting

Ignore this section for documentation-only tasks.

Use the CLI command `pnpm run lint` and no other variation of this command to find common issues. If there is no output from the command, there are no linting issues, and it's OK to continue processing the current task.

- Fix init-declarations warnings by assigning variables to "undefined".
- Fix prefer-const errors by changing declarations to "const".
- Imports :
    - Remove unused imports.
    - Add imports if required.
    - Prefer to import from "barrel" index.js files.
    - Update index.js barrel files if present and as required :
        - Imports require file extensions.
        - Barrel files that include subfolders require 'folder/index.js'
        - This project uses aliases defined in package.json for '#alias_to_folder_name' references.
- Do not remove unused variables, including `catch (error)` parameters. Change unused variable names to a \_name variant.
    - Be careful about renaming variables where a specific name is required and changing that name breaks the code.

Aside from those, only fix issues that you have created, and fix them through reasoning.

In post-processing responses, don't echo lint issues. Note in chat that there are linting warnings and/or errors.

## Formatting

This project uses Prettier to format code and documentation prior to Git commit.

On completion of a task where code is modified, `pnpm run format:src`.

On completion of a task where documentation is modified, `pnpm run format:docs`.

## Project State

This project is published and is used in production. **Exposure is forbidden** of developer names, personal data, keys, and other private information.

## Testing Policy

- Ignore testing instructions for documentation-only tasks.
- Use `pnpm run lint` and no other lint command.
- Do not search for other tests.
