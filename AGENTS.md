# Agents configuration

This document defines expectations, tooling commands, and coding conventions for automated coding agents working in this repository. Agents must follow these rules strictly: they will be used by automated agents (including CI) and by maintainers reviewing automated commits.

If this file conflicts with repository-specific docs (CODEOWNERS, CONTRIBUTING, or explicit owner requests), prefer explicit maintainer instructions. When in doubt, ask a short clarifying question in the relevant issue or PR.

Quick Start for Agents

- Run `bun install` (preferred) or `npm install`.
- Run tests with `bun run test` and fail early if tests or lint fail.
- Use the commit message style `<type>: <short description>` and keep commits small.
- Create a feature branch for non-trivial changes and open a PR; do not push to main directly.
- Do not force-push or amend pushed commits.

Table Of Contents

1. Tooling / Commands
2. Commit & Branching
3. Code Style Guidelines
   - Imports
   - Formatting
   - Types
   - Naming conventions
   - Error handling
4. Tests
5. Security and Secrets
6. Static analysis and type checks
7. Error messages and logging
8. Dependency management
9. PR / Review expectations for automated agents
10. Cursor / Copilot / AI rules
11. Additional guidance for agents
12. Required Agent Behavior Checklist
13. Remediation: leaked secrets

1) Tooling / Commands
 - Install dependencies: `bun install` (preferred) or `npm install`
 - Run all tests: `bun run test` or `npm run test`
 - Run a single test file: `bun run test -- tests/<path-to-test>` or `npx jest tests/<path-to-test>`
 - Run tests matching a name: `npx jest -t "test name regex"`
 - Watch tests: `bun run test:watch` or `npm run test:watch`
 - Lint: `bun run lint` or `npm run lint`
 - Lint and fix: `bun run lint:fix` or `npm run lint:fix`
 - Format code: `bun run format` or `npm run format`
 - Run a single test (fast) with Node/jest directly: `npx jest --runTestsByPath tests/utils.test.ts`

Notes:
 - Use the repository scripts (npm/bun) to keep behavior consistent across machines.
 - For debugging a failing test locally, use `npx jest --runInBand --detectOpenHandles --logHeapUsage`.

Enforcement & CI

 - Agents should assume CI enforces lint/type/tests; design automation to fail early locally.
 - If you add or change checks, update CI workflows and document them here.
 - Prefer non-destructive git operations in automation (create branches, push, open PRs). See sample PR flow below.

Sample PR flow (agent)

1. Create branch: `git checkout -b feat/short-description`
2. Make changes, run `bun run lint` and `bun run test` locally.
3. Stage and commit: `git add -A && git commit -m "feat: short description"`
4. Push: `git push -u origin feat/short-description`
5. Create PR with `gh pr create --title "feat: short description" --body "<bullet summary>"` and return PR URL.


2) Commit & Branching
 - Keep commits small and focused (single logical change per commit).
 - Commit message style: `<type>: <short description>` where type is chore, feat, fix, docs, refactor, test.
 - Always run lint and tests locally before pushing. CI may fail otherwise.
 - When making non-trivial changes, create a feature branch and open a PR rather than committing directly to main.

3) Code Style Guidelines (applies to TypeScript code)
 - Use TypeScript for new code. Keep `strict: true` semantics in mind.
 - File layout: prefer `src/` for implementation files and `tests/` for tests. Keep modules small (<= 200 lines where practical).

Imports
 - Use explicit named imports where possible: `import { fn } from './lib'`.
 - Prefer relative imports inside the project: `import x from '../utils'`.
 - Keep import order: standard libraries (node/bun) -> external packages -> internal modules. Group and separate with a single blank line.
 - Avoid deep relative import chains; prefer `src/` root relative imports if and when the repo is configured for them.

Formatting
 - Use Prettier settings in .prettierrc. Run `bun run format` before committing large refactors.
 - ESLint rules in .eslintrc.cjs are authoritative for linting. Fix errors rather than silencing rules.
 - Line length: up to 100 characters by Prettier config. Break long expressions into well-named intermediate variables.

Types
 - Prefer explicit return types on exported functions and public APIs.
 - Use narrowest possible type. Prefer concrete types over `any`. If `any` is required, add a brief inline comment explaining why.
 - Use discriminated unions for variant-like structures.
 - Avoid `as` casts unless necessary; prefer safer typing patterns or helper functions.

Naming conventions
 - Use camelCase for variables and functions, PascalCase for types and classes, UPPER_SNAKE_CASE for constants that are truly constant.
 - Use clear, descriptive names: prefer `fetchUserById` over `getU`.
 - For boolean-returning functions, use `is/has/can` prefixes (isValid, hasAccess).

Error handling
 - Avoid swallowing errors. Always handle errors at the boundary where they can be meaningfully interpreted.
 - Use `try/catch` sparsely; prefer early validation and returning Result-like objects (where appropriate) for library-level functions.
 - For API/CLI entrypoints, convert errors to informative messages and non-zero exit codes. Include context but avoid leaking secrets.
 - Use custom Error subclasses only when you need to programmatically distinguish errors.

4) Tests
 - Tests should be written with Jest and ts-jest. Place tests under `tests/` mirroring source structure where practical.
 - Test names should be descriptive and small in scope. Use `describe` blocks to group related tests.
 - Use fixtures or factories for repeated test setup to keep tests concise.
 - Prefer unit tests for logic and integration tests for cross-module behaviors.
- Aim for deterministic tests: avoid network, time, and randomness unless explicitly mocked.

Test debugging tips

 - To run a single test file: `npx jest --runTestsByPath tests/utils.test.ts`.
 - To run tests that match a name: `npx jest -t "adds two numbers"`.
 - Use `--runInBand` for debugging race conditions.

Running a single test
 - By file path: `npx jest --runTestsByPath tests/utils.test.ts`
 - By name: `npx jest -t "adds two numbers"`
 - In watch mode: `npx jest --watch` then type `p` to filter by filename or `t` to filter by test name.

5) Security and Secrets
 - NEVER commit secrets, tokens, or credentials to the repo. If a secret is found, rotate it immediately and notify maintainers.
 - Use environment variables for credentials during CI and local development. Document required env vars in README or docs.

Remediation: leaked secrets (brief)

1. Immediately rotate the exposed secret (remove or rotate credentials).
2. Open an internal issue and ping the repo owners with the incident details.
3. If the secret was committed to history and needs removal, coordinate with maintainers before rewriting history; prefer revocation over history-rewriting when possible.
4. Add the secret pattern to `.gitignore` or a secrets detector config (if applicable) to avoid recurrence.


6) Static analysis and type checks
 - Run TypeScript type checks locally: `npx tsc --noEmit` if needed (Bun often integrates, but CI may run tsc).
 - Fix type errors rather than disabling rules. If you must disable a rule, add a short justification comment and link to an issue.

7) Error messages and logging
 - Log messages should include context (IDs, non-secret metadata) and be readable.
 - For server code, use structured logs (JSON) where possible. Keep log levels consistent (debug/info/warn/error).

8) Dependency management
 - Pin devDependencies where practical. When upgrading a dependency, keep updates minimal and run tests + lint.
 - Avoid adding a new dependency for a small utility — prefer small helper functions first.

9) PR / Review expectations for automated agents
 - Keep automated commits small and explain the intent in the commit message.
 - If an automated agent touches multiple areas, create a summary in the PR body describing the scope, risks, and test coverage.
 - Agents must not force-push branches and must not amend commits already pushed to a shared branch.

Required Agent Behavior Checklist (short)

 - Run `bun install` and `bun run lint` and `bun run test` before creating commits.
 - Use the repository scripts for commands; provide both Bun and npm alternatives only when necessary.
 - Create a topic branch and a PR; do not push to protected branches.
 - Do not alter or remove pre-existing commits on shared branches.
 - Use `gh` for PR creation when available and return the PR URL in the agent result.
 - Include a concise PR body with a summary, affected areas, tests added/updated, and any migration steps.


10) Cursor / Copilot / AI rules
 - If repository contains Cursor rules (.cursor/rules/ or .cursorrules) or Copilot instructions (.github/copilot-instructions.md), follow them. There are no Cursor or Copilot rules detected in this repo at the time of writing.

11) Additional guidance for agents
 - Prefer minimal, incremental changes. Big refactors require human sign-off.
 - Before modifying files unrelated to your task, ask a clarifying question.
 - If you detect failing tests or lint errors caused by pre-existing commits, report them and propose fixes rather than automatically rewriting history.

Contact: repo owner (open an issue or PR mentioning them for design/ownership questions)

Version: autogenerated guidance (update when tooling or repo standards change)
