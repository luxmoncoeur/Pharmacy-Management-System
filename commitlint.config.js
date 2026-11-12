// Conventional Commits, checked locally by the husky commit-msg hook (.husky/commit-msg).
// CI checks PR titles against the same rules (release-reusable.yml from ci-cd-template), because squash
// merges turn the PR title into the commit on main. Cheat sheet: docs/conventional-commits.md
export default {
  extends: ['@commitlint/config-conventional'],
};
