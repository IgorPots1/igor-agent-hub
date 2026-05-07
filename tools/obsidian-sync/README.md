# Obsidian Sync

This is a local-only helper that downloads the existing Obsidian export ZIP from the deployed app and syncs it into a managed folder inside a local Obsidian vault.

It does not change the Telegram bot, Supabase schema, reminder logic, or export formatting. Vercel never writes directly into Obsidian. Only this local script touches the vault.

## What It Replaces

The script only replaces the managed target folder:

```text
$OBSIDIAN_VAULT_PATH/$OBSIDIAN_TARGET_FOLDER
```

It never deletes or overwrites the whole vault. Anything outside that managed folder is left untouched.

## Required Environment Variables

```text
OBSIDIAN_EXPORT_URL=https://your-domain.example/api/export/obsidian
EXPORT_SECRET=your_export_secret_here
OBSIDIAN_VAULT_PATH=/Users/your-name/Documents/Obsidian/My Vault
OBSIDIAN_TARGET_FOLDER=Second Brain
```

`OBSIDIAN_TARGET_FOLDER` is optional and defaults to `Second Brain`.

You can copy `tools/obsidian-sync/.env.example` into your preferred local env file and load it before running the script.

## Manual Run

From the repository root:

```bash
npm run obsidian:sync
```

Or with inline env vars:

```bash
OBSIDIAN_EXPORT_URL="https://your-domain.example/api/export/obsidian" \
EXPORT_SECRET="your_export_secret_here" \
OBSIDIAN_VAULT_PATH="/Users/your-name/Documents/Obsidian/My Vault" \
OBSIDIAN_TARGET_FOLDER="Second Brain" \
npm run obsidian:sync
```

## Sync Flow

The script:

1. Reads the local env vars.
2. Downloads the ZIP export with `Authorization: Bearer <EXPORT_SECRET>`.
3. Writes the ZIP into a temporary directory.
4. Extracts the archive into temporary space with zip-path safety checks.
5. Verifies the extracted export contains at least one Markdown file.
6. Copies the extracted export into a temporary target folder inside the vault.
7. Replaces only the managed target folder, keeping at most one adjacent backup folder when a previous sync exists.

## macOS Automation Later

If you want this to run automatically on macOS, the safest next step is a local `launchd` job that invokes `npm run obsidian:sync` on a schedule. Keep the env vars local on the Mac and do not move this logic into Vercel.

Recommended shape later:

- Store secrets and vault path only on the local machine.
- Run the script via `launchd` on an interval such as every 15-60 minutes.
- Point the job at this repo checkout and the same local Obsidian vault path.

## Notes

- Keep `EXPORT_SECRET` out of git and out of logs.
- If the export download fails, is not a ZIP, or extracts to no Markdown files, the sync fails without touching the managed folder.
- If the target folder already exists, the previous version is moved to a single backup folder before the new one is swapped into place.
