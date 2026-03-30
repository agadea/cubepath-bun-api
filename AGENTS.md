# Agents configuration

This repository is intended to be worked on by humans and agentic coding agents. This AGENTS.md file defines the expected behaviour, commands, and coding conventions agents must follow when modifying this codebase. Treat this document as authoritative for agent behaviour unless an explicit maintainer instruction (CODEOWNERS, CONTRIBUTING, or a maintainer comment on an open issue/PR) overrides it.

Quick Start

- Install dependencies (preferred): `bun install`.
- Install with npm: `npm install` (fallback if Bun is not available).
- Run tests: `bun run test` or `npm run test`.
- Run development server (hot-reload): `bun run dev` (configured to use `nodemon` to restart on src changes).
- Run production server: `bun run start`.

Table of Contents

1. Tooling / Commands
2. Commit & Branching
3. Code Style Guidelines
   - Imports
   - Formatting
   - Types
   - Naming
   - Error handling
4. Tests
5. Security and Secrets
6. Static analysis and type checks
7. Logging & Error Messages
8. Dependency management
9. PR / Review expectations for automated agents
10. Cursor / Copilot / AI rules
11. Required Agent Behaviour Checklist
12. Remediation: leaked secrets

1) Tooling / Commands

- Install dependencies (Bun):
  - `bun install`
  - CI note: CI may run `bun install --frozen-lockfile`. If that fails because the lockfile needs updating, run `bun install` locally, commit the updated `bun.lock`, and re-run CI.
- Install dependencies (npm): `npm install` (use only if Bun is not available).
- Run all tests: `bun run test` or `npm run test` (equivalent to running `jest`).
- Run a single test file:
  - Bun: `bun run test -- tests/<path-to-test>`
  - Direct Jest: `npx jest --runTestsByPath tests/utils.test.ts`
  - By test name: `npx jest -t "adds two numbers"`
  - Watch mode: `npx jest --watch` (then type `p` to filter by filename or `t` to filter by test name)
- Lint: `bun run lint` or `npm run lint`
- Lint and fix: `bun run lint:fix` or `npm run lint:fix`
- Format: `bun run format` or `npm run format`
- Dev (hot-reload): `bun run dev` — nodemon is used to restart `bun index.ts` on `src` changes
- Start (production): `bun run start` (runs `bun index.ts`)

Notes:
- Use the repository scripts so behavior is consistent across environments.
- When debugging tests use: `npx jest --runInBand --detectOpenHandles --logHeapUsage`.

2) Commit & Branching

- Keep commits small and focused: one logical change per commit.
- Commit message format: `<type>: <short description>` where `type` ∈ {chore, feat, fix, docs, refactor, test}.
- Always run `bun run lint` and `bun run test` locally before pushing. CI will run these checks.
- For non-trivial changes create a feature branch and open a PR rather than pushing directly to `main`.
- Do not force-push (`--force`) to shared branches. If you must rewrite history, coordinate with maintainers first.

3) Code Style Guidelines (TypeScript)

General
- Prefer TypeScript for new code. Keep `strict` semantics in mind (`tsconfig.json` is configured accordingly).
- Put implementation under `src/`, tests under `tests/`, and small one-off scripts at project root only when necessary.
- Keep modules small and single-responsibility. Aim for files under ~200 lines when practical.

Imports
- Use explicit named imports where possible: `import { parse } from './lib'`.
- Prefer shallow relative imports inside the repo: `import x from '../utils'`. Avoid deeply nested chains like `../../../foo` — reorganize modules if needed.
- Order imports: built-ins (node/bun) → external packages → internal modules. Separate groups with a single blank line.

Formatting
- Use Prettier as configured in `.prettierrc`. Run `bun run format` before large commits.
- ESLint rules in `.eslintrc.cjs` are authoritative. Fix linter errors rather than silencing rules.
- Line length up to 100 characters (prettier config). Break expressions into well-named intermediate variables when necessary.

Types
- Prefer explicit return types on exported functions and public APIs.
- Narrow types: prefer concrete types over `any`. If `any` is necessary, add a brief comment explaining why.
- Use discriminated unions for variant-like data structures.
- Avoid `as` type assertions except when bridging external APIs; try to write safe conversion helpers instead.

Naming conventions
- `camelCase` for variables and functions, `PascalCase` for types and classes, `UPPER_SNAKE_CASE` for true constants.
- Use descriptive names: `fetchUserById` instead of `getU`.
- For booleans use `is/has/can` prefixes (e.g., `isValid`, `hasAccess`).

Error handling
- Do not swallow errors. Handle them at the boundary where they can be meaningfully acted upon.
- Prefer returning Result-like values in library code when the caller needs to inspect errors; for application entrypoints convert errors to proper HTTP responses or exit codes.
- Use `try/catch` around external I/O and convert to domain-specific errors where appropriate.
- Use custom `Error` subclasses only when you need to differentiate error kinds programmatically.

4) Tests

- Tests use Jest + ts-jest. Keep tests in `tests/` mirroring your `src/` layout.
- Test names should be descriptive and small in scope. Use `describe` to group related tests.
- Prefer unit tests for pure logic and integration tests for cross-module behavior.
- Aim for deterministic tests: avoid network, time, and randomness. Mock external services and random values.

Running single tests
- By path: `npx jest --runTestsByPath tests/utils.test.ts`
- By name: `npx jest -t "adds two numbers"`
- In watch mode: `npx jest --watch` then `p` to filter by filename or `t` to filter by test name.

Test debugging tips
- Use `--runInBand` to run tests serially when diagnosing flakiness.
- Use `--detectOpenHandles` to identify resource leaks that keep Node from exiting.

5) Security and Secrets

- Never commit secrets to the repo. If you find secrets, rotate them immediately and notify maintainers.
- Use environment variables for credentials and list required vars in README or docs.

6) Static analysis and type checks

- Run `npx tsc --noEmit` locally if you want a strict type check pass (CI may run type checks too).
- Fix type errors rather than disabling rules. If a rule must be disabled, document the justification and link to an issue.

7) Error messages and logging

- Logs should include context (IDs, non-secret metadata) and be structured where possible.
- Keep log levels consistent: debug/info/warn/error. Avoid verbose logging in hot loops.

8) Dependency management

- Pin devDependency versions in package.json. When upgrading, keep changes minimal and run tests + lint.
- Avoid adding new dependencies for small utilities. Prefer a small helper function before introducing a new package.

9) PR / Review expectations for automated agents

- Automated commits must be small and explain their intent in the commit message.
- When touching multiple areas, include a summary in the PR body explaining scope, risks, and tests added.
- Agents must not force-push to shared branches or amend commits once pushed, unless explicitly approved by maintainers.

10) Cursor / Copilot / AI rules

- If the repo contains Cursor rules (in `.cursor/rules/` or `.cursorrules`) or Copilot instructions (`.github/copilot-instructions.md`), follow them. There are no Cursor or Copilot rules detected at the time this document was generated.

11) Required Agent Behaviour Checklist

- Run `bun install`, `bun run lint`, and `bun run test` before creating commits.
- Use repository scripts (`bun run <script>`) rather than invoking tools with ad-hoc args when possible.
- Create a feature branch for non-trivial changes and open a PR; do not push to protected branches.
- Do not alter or remove existing commits on shared branches. If rebasing is necessary, coordinate with maintainers.
- Include a concise PR body with a summary, affected files, tests added/updated, and any migration steps.

12) Remediation: leaked secrets

1. Rotate the exposed secret immediately (revoke and create a new credential).
2. Open an internal issue and tag maintainers with incident details and the commit that introduced the secret.
3. Prefer revocation over history-rewriting. If history must be rewritten, coordinate with the team and update downstream consumers.
4. Add the leaked pattern to `.gitignore` and update any pre-commit secret scanners.

Contact

For questions about policy or ownership, open an issue or PR and mention the repository owner/maintainers.

Version

This file is a living document and may be updated as the repository and its workflows evolve. Update it when the tooling or process changes.
