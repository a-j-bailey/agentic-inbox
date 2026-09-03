// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { describe, expect, it } from "vitest";
import { webhookMatchesFilter } from "./webhooks";

describe("webhookMatchesFilter", () => {
	const base = {
		event: "email.received",
		enabled: true,
		mailbox_id: null as string | null,
		assignee: null as string | null,
	};

	it("matches an enabled row with no filters", () => {
		expect(
			webhookMatchesFilter(base, {
				event: "email.received",
				mailboxId: "inbox@example.com",
			}),
		).toBe(true);
	});

	it("rejects disabled rows", () => {
		expect(
			webhookMatchesFilter(
				{ ...base, enabled: false },
				{ event: "email.received", mailboxId: "inbox@example.com" },
			),
		).toBe(false);
	});

	it("rejects a different event", () => {
		expect(
			webhookMatchesFilter(base, {
				event: "task.created",
				assignee: "Ponder",
			}),
		).toBe(false);
	});

	it("matches mailbox filter exactly and ignores other mailboxes", () => {
		const filtered = { ...base, mailbox_id: "inbox@example.com" };
		expect(
			webhookMatchesFilter(filtered, {
				event: "email.received",
				mailboxId: "inbox@example.com",
			}),
		).toBe(true);
		expect(
			webhookMatchesFilter(filtered, {
				event: "email.received",
				mailboxId: "other@example.com",
			}),
		).toBe(false);
	});

	it("matches assignee filter on the new assignee", () => {
		const filtered = {
			...base,
			event: "task.assigned",
			assignee: "Ponder",
		};
		expect(
			webhookMatchesFilter(filtered, {
				event: "task.assigned",
				assignee: "Ponder",
			}),
		).toBe(true);
		expect(
			webhookMatchesFilter(filtered, {
				event: "task.assigned",
				assignee: "Donna",
			}),
		).toBe(false);
	});
});
