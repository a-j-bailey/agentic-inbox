// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { describe, expect, it } from "vitest";
import {
	isBotAccessEnabled,
	mcpMailboxNotFoundMessage,
} from "./bot-access";

describe("isBotAccessEnabled", () => {
	it("defaults on when settings are missing", () => {
		expect(isBotAccessEnabled(undefined)).toBe(true);
		expect(isBotAccessEnabled(null)).toBe(true);
		expect(isBotAccessEnabled({})).toBe(true);
	});

	it("is on when botAccess is true", () => {
		expect(isBotAccessEnabled({ botAccess: true })).toBe(true);
	});

	it("is off only for an explicit false", () => {
		expect(isBotAccessEnabled({ botAccess: false })).toBe(false);
	});
});

describe("mcpMailboxNotFoundMessage", () => {
	it("matches the existing MCP not-found shape", () => {
		expect(mcpMailboxNotFoundMessage("kit@example.com")).toBe(
			`Mailbox "kit@example.com" not found. Use list_mailboxes to see available mailboxes.`,
		);
	});
});
