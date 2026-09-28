# Developer Workflow & Engineering Standards

**Access Classification:** ROLE: DEVELOPER, TEAM_LEAD, MANAGER

## 1. Git Branching & Commit Conventions
- All feature work must branch from `main` using the syntax `feature/AUR-<issue_number>-<slug>` (example: `feature/AUR-101-hmac-verification`).
- Bugfixes must branch with `fix/AUR-<issue_number>-<slug>`.
- Commit messages must strictly follow the Conventional Commits specification (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`).

## 2. Test Coverage & Quality Gates
- **Minimum Test Coverage:** Every pull request must maintain or increase overall test coverage, with a hard floor of **85% unit test coverage** enforced by CI.
- All asynchronous endpoints must include pytest-asyncio integration tests covering 4xx and 5xx exception handling.
- Maximum cyclomatic complexity per function must not exceed 10.

## 3. Code Review & Approval Rules
- Every pull request requires **at least two approvals**: one from a peer developer and one from a Team Lead (`role: team_lead`) before merging.
- Merges to `main` must use squash-and-merge to maintain a linear commit history.
