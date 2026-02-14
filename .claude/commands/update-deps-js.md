---
description: "Update all dependencies in a javascript project"
---

Update the dependencies in this Node.js project autonomously and safely. Follow this process:

1. Run `npx npm-check-updates` to check available updates and analyze the results.

2. Check `docs/DEPENDENCY_ISSUES.md` for earlier problems with tests and make sure to update those dependencies one by one no matter the semver version jump

3. Create a staged update strategy:

   **Stage 1 - Patch updates (safest):**
   - Run `npx npm-check-updates -u --target patch`
   - Run `npm install`
   - Run tests with `npm test`
   - If tests fail, revert package.json and document which patch updates caused issues
   - once you are done commit changes

   **Stage 2 - Minor updates (moderate risk):**
   - Run `npx npm-check-updates -u --target minor`
   - Run `npm install`
   - Run tests
   - If tests fail, use `npx npm-check-updates --doctor -u --target minor` to automatically identify and revert problematic updates
   - once you are done commit changes

   **Stage 3 - Major updates (highest risk):**
   - Run `npx npm-check-updates --target major` to list major updates
   - For each major update, check the package's changelog/release notes
   - Only apply major updates that are explicitly backwards compatible or low-risk
   - Use `npx npm-check-updates -u --filter <package-name>` to update specific packages one at a time
   - Test after each major update
   - commit each major update separately

4. Provide a detailed report:
   - Successfully updated dependencies with versions
   - Failed updates and why they were reverted
   - Major updates that were skipped and require manual review, highlight potential changes
   - Any security vulnerabilities found
   - Recommended next steps

Prioritize stability over having the absolute latest versions. Document all decisions made.
