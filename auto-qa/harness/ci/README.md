# auto-qa/harness/ci/ — CI workflow staging area

GitHub blocks OAuth Apps without `workflow` scope from creating or
modifying files under `.github/workflows/`. The harness ships
its CI workflow files here as `.staged` artifacts so they're
review-able + version-controlled, then a maintainer with a
`workflow`-scoped token (or the GitHub web UI) promotes them into
the live `.github/workflows/` directory.

## Promoting a staged workflow

```bash
mkdir -p .github/workflows
cp auto-qa/harness/ci/<name>.yml.staged .github/workflows/<name>.yml
git add .github/workflows/<name>.yml
git commit -m "ci: promote auto-qa harness <name>"
git push
```

The `.staged` extension prevents GitHub Actions from running the
file from this location (Actions only scans `.github/workflows/`).

## Currently staged

| File                                         | Phase 7 sub-slice | Triggers           | Status       |
|----------------------------------------------|-------------------|--------------------|--------------|
| `auto-qa-harness.yml.staged`                 | 3a                | `workflow_dispatch` | ⏳ awaiting promotion |
| `auto-qa-harness-scenarios.yml.staged`       | 3c                | `workflow_dispatch` | ⏳ awaiting promotion |

**Promote in this order**: `auto-qa-harness.yml.staged` first
(fast drift check, low risk), smoke-test it via the Actions UI,
then promote `auto-qa-harness-scenarios.yml.staged` (heavier
Playwright run). Each is independent — neither depends on the
other being live — but smoke-testing the cheap one first is the
sane sequence.

## Why this dance

The CI workflow content is reviewed + locked in version control
(same as any other code) without depending on whether the bot has
`workflow`-scoped credentials. When the maintainer promotes a
file, no review is needed — the content already passed code
review at the staging step.
