// assets/config.js — local secrets, never committed (see .gitignore)
// To enable the manual Refresh Scores button:
//   1. Create a GitHub fine-grained PAT with:
//        - Repository: world-cup-2026
//        - Permissions: Actions → Read & Write
//   2. Paste the token value below and save.
//   3. This file is gitignored and will never be pushed to GitHub.

export const GITHUB_REFRESH_TOKEN = '';
export const GITHUB_OWNER         = 'dennismzanetti';
export const GITHUB_REPO          = 'world-cup-2026';
export const GITHUB_WORKFLOW_ID   = 'sync-scores.yml';
export const GITHUB_BRANCH        = 'main';
