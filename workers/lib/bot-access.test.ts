// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { app } from "../index";
import { listMailboxes } from "./email-helpers";
import { defaultMailboxSettings } from "./mailbox-settings";
import { toolListMailboxes, toolVerifyMcpMailbox } from "./tools";
import { mcpMailboxNotFoundMessage } from "../../shared/bot-access";

function createMemoryBucket(mailboxes: Record<string, unknown> = {}) {
	const store = new Map<string, string>();
	for (const [id, settings] of Object.entries(mailboxes)) {
		store.set(`mailboxes/${id}.json`, JSON.stringify(settings));
	}
	return {
		async head(key: string) {
			if (!store.has(key)) return null;
			return { key };
		},
		async get(key: string) {
			const value = store.get(key);
			if (value === undefined) return null;
			return {
				json: async () => JSON.parse(value) as unknown,
				text: async () => value,
			};
		},
		async put(key: string, value: unknown) {
			store.set(key, typeof value === "string" ? value : String(value));
		},
		async delete(key: string) {
			store.delete(key);
		},
		async list(options?: { prefix?: string }) {
			const prefix = options?.prefix ?? "";
			return {
				objects: [...store.keys()]
					.filter((key) => key.startsWith(prefix))
					.map((key) => ({ key })),
				truncated: false,
			};
		},
	};
}

function createApiEnv(mailboxes: Record<string, unknown> = {}) {
	return {
		BUCKET: createMemoryBucket(mailboxes),
		DOMAINS: "example.com",
		EMAIL_ADDRESSES: [],
		MAILBOX: {
			idFromName: (name: string) => name,
			get: () => ({
				getFolders: async () => [],
			}),
		},
	};
}

const hidden = "hidden@example.com";
const visible = "bot@example.com";
const legacy = "legacy@example.com";

describe("mailbox settings persist", () => {
	it("defaults bot access on for new mailboxes", async () => {
		expect(defaultMailboxSettings("Ada").botAccess).toBe(true);
		const env = createApiEnv();
		const res = await app.request(
			"/api/v1/mailboxes",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "new@example.com", name: "New" }),
			},
			env,
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { settings: { botAccess: boolean } };
		expect(body.settings.botAccess).toBe(true);
	});

	it("persists botAccess through mailbox settings PUT and GET", async () => {
		const env = createApiEnv({ [visible]: { fromName: "Bot" } });
		const path = `/api/v1/mailboxes/${encodeURIComponent(visible)}`;
		const put = await app.request(
			path,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					settings: { fromName: "Bot", botAccess: false },
				}),
			},
			env,
		);
		expect(put.status).toBe(200);
		const get = await app.request(path, {}, env);
		const body = (await get.json()) as { settings: { botAccess: boolean } };
		expect(body.settings.botAccess).toBe(false);
	});
});

describe("web mailbox list", () => {
	it("still lists mailboxes with bot access off", async () => {
		const env = createApiEnv({
			[hidden]: { botAccess: false, fromName: "Hidden" },
			[visible]: { botAccess: true, fromName: "Bot" },
		});
		const res = await app.request("/api/v1/mailboxes", {}, env);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{
			email: string;
			settings: { botAccess?: boolean };
		}>;
		const emails = body.map((mailbox) => mailbox.email).sort();
		expect(emails).toEqual([hidden, visible].sort());
		expect(body.find((mailbox) => mailbox.email === hidden)?.settings.botAccess).toBe(
			false,
		);
	});
});

describe("MCP mailbox access", () => {
	it("omits bot-access-off mailboxes from list_mailboxes", async () => {
		const env = createApiEnv({
			[hidden]: { botAccess: false },
			[visible]: { botAccess: true },
			[legacy]: { fromName: "Legacy" },
		});
		const listed = await toolListMailboxes(env);
		expect(listed.map((mailbox) => mailbox.email).sort()).toEqual(
			[legacy, visible].sort(),
		);
	});

	it("uses the same not-found error for missing and bot-access-off mailboxes", async () => {
		const env = createApiEnv({ [hidden]: { botAccess: false } });
		const off = await toolVerifyMcpMailbox(env, hidden);
		const missing = await toolVerifyMcpMailbox(env, "ghost@example.com");
		expect(off).toBe(mcpMailboxNotFoundMessage(hidden));
		expect(missing).toBe(mcpMailboxNotFoundMessage("ghost@example.com"));
	});

	it.each(["get_email", "send_email", "create_draft"] as const)(
		"MCP %s refuses a mailbox with bot access off",
		async () => {
			const env = createApiEnv({ [hidden]: { botAccess: false } });
			const error = await toolVerifyMcpMailbox(env, hidden);
			expect(error).toBe(mcpMailboxNotFoundMessage(hidden));
		},
	);

	it("allows MCP tools when bot access is on or unset", async () => {
		const env = createApiEnv({
			[visible]: { botAccess: true },
			[legacy]: {},
		});
		expect(await toolVerifyMcpMailbox(env, visible)).toBeNull();
		expect(await toolVerifyMcpMailbox(env, legacy)).toBeNull();
	});

	it("gates every mailboxId MCP tool behind verifyMailbox", () => {
		const src = readFileSync(
			join(dirname(fileURLToPath(import.meta.url)), "../mcp/index.ts"),
			"utf8",
		);
		const toolNames = [
			...src.matchAll(/this\.server\.tool\(\s*"([^"]+)"/g),
		].map((match) => match[1]);
		const mailboxIdTools = toolNames.filter(
			(name) =>
				name !== "list_mailboxes" &&
				name !== "list_tasks" &&
				name !== "get_task" &&
				name !== "create_task" &&
				name !== "update_task" &&
				name !== "list_agents" &&
				name !== "add_task_update",
		);
		expect(mailboxIdTools.length).toBeGreaterThan(0);
		const verifyCalls = [...src.matchAll(/await verifyMailbox\(mailboxId\)/g)];
		expect(verifyCalls.length).toBe(mailboxIdTools.length);
		expect(src).toContain("toolVerifyMcpMailbox");
		expect(src).toContain("toolListMailboxes");
	});

	it("MCP task tools do not require mailboxId", () => {
		const src = readFileSync(
			join(dirname(fileURLToPath(import.meta.url)), "../mcp/index.ts"),
			"utf8",
		);
		const taskTools = [
			"list_tasks",
			"get_task",
			"create_task",
			"update_task",
			"add_task_update",
			"list_agents",
		];
		for (const name of taskTools) {
			expect(src).toContain(`"${name}"`);
		}
		expect(src).not.toContain("delete_task");
		const createBlock = src.slice(src.indexOf('"create_task"'), src.indexOf('"update_task"'));
		expect(createBlock).not.toContain("verifyMailbox");
		const listBlock = src.slice(src.indexOf('"list_tasks"'), src.indexOf('"get_task"'));
		expect(listBlock).not.toContain("verifyMailbox");
	});
});

describe("listMailboxes", () => {
	it("returns settings for the web list without dropping off mailboxes", async () => {
		const bucket = createMemoryBucket({
			[hidden]: { botAccess: false },
			[visible]: { botAccess: true },
		});
		const listed = await listMailboxes(bucket);
		expect(listed.map((mailbox) => mailbox.email).sort()).toEqual(
			[hidden, visible].sort(),
		);
	});
});
