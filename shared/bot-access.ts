// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

/**
 * Per-mailbox MCP / bot access.
 *
 * Missing or unreadable values default to on so existing mailboxes stay
 * visible to MCP after deploy. The web app ignores this flag.
 */

export function isBotAccessEnabled(settings: unknown): boolean {
	if (settings === null || typeof settings !== "object" || Array.isArray(settings)) {
		return true;
	}
	if (!("botAccess" in settings)) {
		return true;
	}
	return settings.botAccess !== false;
}

export function mcpMailboxNotFoundMessage(mailboxId: string): string {
	return `Mailbox "${mailboxId}" not found. Use list_mailboxes to see available mailboxes.`;
}
