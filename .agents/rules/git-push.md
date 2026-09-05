# Automatic Git Push Rule

## Mandatory Workflow
After making ANY changes to the codebase (feature updates, bug fixes, refactoring, or additions):
1. Test and verify changes (e.g. `npm run build` if relevant).
2. Stage all modifications: `git add .`
3. Commit with a clear, descriptive commit message: `git commit -m "<type>(<scope>): <summary>"`
4. Immediately push to the remote repository: `git push origin main`
5. Never leave uncommitted or unpushed changes at the end of a response.
