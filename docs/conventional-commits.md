# Conventional Commits cheat sheet

Releases are fully automated: the commit messages on `main` decide the next version. With squash merges
(the recommended setup), **the PR title is the commit message**, so the PR title is what counts. The PR
description becomes the commit body: put details there, and a `BREAKING CHANGE:` footer if there is one.

```
<type>(<optional scope>)<optional !>: <description>

<optional body>

<optional footer(s)>
```

## What releases what

| You write | Release | Example → version after `1.4.2` |
| --- | --- | --- |
| `feat: …` | **minor** | `feat: add CSV export` → `1.5.0` |
| `fix: …` | **patch** | `fix: handle empty input` → `1.4.3` |
| `perf: …` | **patch** | `perf: cache parsed config` → `1.4.3` |
| `<any type>!: …` | **major** | `feat!: drop Node 20 support` → `2.0.0` |
| footer `BREAKING CHANGE: …` | **major** | see below → `2.0.0` |
| `revert: …` with a `This reverts commit <sha>.` body | **patch** | what `git revert` writes → `1.4.3` |
| `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore` (and a bare `revert:` title) | none | `docs: fix typo` → no release |

With several commits since the last release, the biggest bump wins: `fix` + `feat` → minor.
The very first release is `1.0.0`.

Commits that don't release still show up in history, and `feat`/`fix`/`perf` (plus breaking changes) are
what appear in `CHANGELOG.md` and the GitHub Release notes.

## Examples

```text
feat(api): add search endpoint
fix: return 404 instead of 500 for unknown ids
perf(parser): skip re-tokenizing unchanged files
docs: explain the deploy secrets
chore(deps): bump vitest to 5.1.0
refactor!: rename `parse()` to `parseCommit()`
```

A breaking change in the footer (for a longer explanation). In a PR, put the footer at the end of the PR
description; the release preview reads it too:

```text
feat: support multiple config files

BREAKING CHANGE: `config` is now an array. Wrap a single config in [ ].
```

## Rules the checks enforce

The local `commit-msg` hook and the CI PR-title check both use
[`@commitlint/config-conventional`](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-conventional).
The ones people trip over:

- **type** must be lowercase and one of: `feat`, `fix`, `perf`, `docs`, `style`, `refactor`, `test`,
  `build`, `ci`, `chore`, `revert`.
- **A colon and a space** after the type/scope: `feat: x`, not `feat:x` or `feat - x`.
- **Description** starts lowercase-ish (not `Sentence case`, `Start Case` or `UPPER CASE`) and doesn't
  end with a period.
- **Header** at most 100 characters.

| ❌ Rejected | ✅ Accepted |
| --- | --- |
| `Update README` | `docs: update README` |
| `feat: Add search.` | `feat: add search` |
| `fix:handle empty input` | `fix: handle empty input` |
| `Feature(api): search` | `feat(api): search` |

## When a check fails

- **Local commit rejected**: fix the message and commit again. To rewrite the last one:
  `git commit --amend`. (`git commit --no-verify` skips the hook, but the PR title still gets checked.)
- **PR title check failed**: edit the PR title on GitHub. CI re-runs on its own and the release preview
  comment updates.
- **Squash merge**: GitHub pre-fills the commit title from the PR title and the body from the description.
  Check that the title box shows the PR title before confirming, then leave it as is.
