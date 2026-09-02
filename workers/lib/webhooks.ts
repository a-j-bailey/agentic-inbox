// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	isWebhookEvent,
	maskWebhookSecret,
	webhookMatchesFilter,
	type WebhookEvent,
	type WebhookFilterContext,
	type WebhookPayload,
	type WebhookSubscription,
} from "../../shared/webhooks";

export type WebhookResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: string; status: 400 | 404 };

export type CreateWebhookInput = {
	event: string;
	url: string;
	secret: string;
	mailbox_id?: string | null;
	assignee?: string | null;
};

export type UpdateWebhookInput = {
	enabled?: boolean;
	url?: string;
	secret?: string;
	mailbox_id?: string | null;
	assignee?: string | null;
};

type WebhookRow = Record<string, unknown>;

const WEBHOOK_TIMEOUT_MS = 5_000;

function asString(value: unknown): string {
	return typeof value === "string" ? value : String(value ?? "");
}

function asNullableString(value: unknown): string | null {
	if (value == null) return null;
	const text = asString(value).trim();
	return text.length > 0 ? text : null;
}

function asEnabled(value: unknown): boolean {
	return value === 1 || value === true || value === "1";
}

function fail<T>(error: string, status: 400 | 404): WebhookResult<T> {
	return { ok: false, error, status };
}

function ok<T>(value: T): WebhookResult<T> {
	return { ok: true, value };
}

function mapWebhook(row: WebhookRow): WebhookSubscription {
	const event = asString(row.event);
	if (!isWebhookEvent(event)) {
		throw new Error(`Invalid webhook event in database: ${event}`);
	}
	return {
		id: asString(row.id),
		event,
		url: asString(row.url),
		secret: maskWebhookSecret(asString(row.secret)),
		mailbox_id: asNullableString(row.mailbox_id),
		assignee: asNullableString(row.assignee),
		enabled: asEnabled(row.enabled),
		created_at: asString(row.created_at),
	};
}

function normalizeOptionalFilter(value: string | null | undefined): string | null {
	if (value == null) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function parseWebhookUrl(raw: string): WebhookResult<string> {
	const trimmed = raw.trim();
	if (!trimmed) return fail("url is required", 400);
	try {
		const parsed = new URL(trimmed);
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			return fail("url must be http or https", 400);
		}
		return ok(parsed.toString());
	} catch {
		return fail("url is invalid", 400);
	}
}

export async function listWebhooks(db: D1Database): Promise<WebhookSubscription[]> {
	const { results } = await db
		.prepare(
			"SELECT id, event, url, secret, mailbox_id, assignee, enabled, created_at FROM webhook_subscriptions ORDER BY created_at DESC",
		)
		.all<WebhookRow>();
	return (results ?? []).map(mapWebhook);
}

export async function createWebhook(
	db: D1Database,
	input: CreateWebhookInput,
): Promise<WebhookResult<WebhookSubscription>> {
	const event = input.event.trim();
	if (!isWebhookEvent(event)) return fail("Invalid event", 400);
	const url = parseWebhookUrl(input.url);
	if (!url.ok) return url;
	const secret = input.secret.trim();
	if (!secret) return fail("secret is required", 400);

	const id = crypto.randomUUID();
	const created_at = new Date().toISOString();
	const mailbox_id = normalizeOptionalFilter(input.mailbox_id);
	const assignee = normalizeOptionalFilter(input.assignee);

	await db
		.prepare(
			`INSERT INTO webhook_subscriptions (
				id, event, url, secret, mailbox_id, assignee, enabled, created_at
			) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
		)
		.bind(id, event, url.value, secret, mailbox_id, assignee, created_at)
		.run();

	return ok({
		id,
		event,
		url: url.value,
		secret: maskWebhookSecret(secret),
		mailbox_id,
		assignee,
		enabled: true,
		created_at,
	});
}

export async function updateWebhook(
	db: D1Database,
	id: string,
	input: UpdateWebhookInput,
): Promise<WebhookResult<WebhookSubscription>> {
	const row = await db
		.prepare(
			"SELECT id, event, url, secret, mailbox_id, assignee, enabled, created_at FROM webhook_subscriptions WHERE id = ?",
		)
		.bind(id)
		.first<WebhookRow>();
	if (!row) return fail("Webhook not found", 404);

	let url = asString(row.url);
	if (input.url !== undefined) {
		const parsed = parseWebhookUrl(input.url);
		if (!parsed.ok) return parsed;
		url = parsed.value;
	}

	let secret = asString(row.secret);
	if (input.secret !== undefined) {
		const next = input.secret.trim();
		if (!next) return fail("secret is required", 400);
		secret = next;
	}

	const mailbox_id =
		input.mailbox_id !== undefined
			? normalizeOptionalFilter(input.mailbox_id)
			: asNullableString(row.mailbox_id);
	const assignee =
		input.assignee !== undefined
			? normalizeOptionalFilter(input.assignee)
			: asNullableString(row.assignee);
	const enabled = input.enabled !== undefined ? input.enabled : asEnabled(row.enabled);

	await db
		.prepare(
			`UPDATE webhook_subscriptions SET
				url = ?, secret = ?, mailbox_id = ?, assignee = ?, enabled = ?
			WHERE id = ?`,
		)
		.bind(url, secret, mailbox_id, assignee, enabled ? 1 : 0, id)
		.run();

	const event = asString(row.event);
	if (!isWebhookEvent(event)) {
		return fail("Invalid event", 400);
	}

	return ok({
		id,
		event,
		url,
		secret: maskWebhookSecret(secret),
		mailbox_id,
		assignee,
		enabled,
		created_at: asString(row.created_at),
	});
}

export async function deleteWebhook(
	db: D1Database,
	id: string,
): Promise<WebhookResult<{ id: string }>> {
	const row = await db
		.prepare("SELECT id FROM webhook_subscriptions WHERE id = ?")
		.bind(id)
		.first<WebhookRow>();
	if (!row) return fail("Webhook not found", 404);
	await db.prepare("DELETE FROM webhook_subscriptions WHERE id = ?").bind(id).run();
	return ok({ id });
}

type DeliveryRow = {
	id: string;
	event: WebhookEvent;
	url: string;
	secret: string;
	mailbox_id: string | null;
	assignee: string | null;
	enabled: boolean;
};

async function listEnabledForEvent(
	db: D1Database,
	event: WebhookEvent,
): Promise<DeliveryRow[]> {
	const { results } = await db
		.prepare(
			"SELECT id, event, url, secret, mailbox_id, assignee, enabled FROM webhook_subscriptions WHERE event = ? AND enabled = 1",
		)
		.bind(event)
		.all<WebhookRow>();
	return (results ?? []).map((row) => {
		const rowEvent = asString(row.event);
		if (!isWebhookEvent(rowEvent)) {
			throw new Error(`Invalid webhook event in database: ${rowEvent}`);
		}
		return {
			id: asString(row.id),
			event: rowEvent,
			url: asString(row.url),
			secret: asString(row.secret),
			mailbox_id: asNullableString(row.mailbox_id),
			assignee: asNullableString(row.assignee),
			enabled: asEnabled(row.enabled),
		};
	});
}

async function deliverWebhook(subscription: DeliveryRow, payload: WebhookPayload): Promise<void> {
	try {
		const res = await fetch(subscription.url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${subscription.secret}`,
			},
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
		});
		if (!res.ok) {
			console.error("webhook delivery failed", {
				id: subscription.id,
				event: subscription.event,
				status: res.status,
			});
		}
	} catch (error) {
		console.error("webhook delivery failed", {
			id: subscription.id,
			event: subscription.event,
			reason: (error as Error).name,
		});
	}
}

export async function dispatchWebhooks(
	db: D1Database,
	context: WebhookFilterContext & { payload: WebhookPayload },
): Promise<void> {
	try {
		const rows = await listEnabledForEvent(db, context.event);
		const matches = rows.filter((row) => webhookMatchesFilter(row, context));
		await Promise.all(matches.map((row) => deliverWebhook(row, context.payload)));
	} catch (error) {
		console.error("webhook dispatch failed:", (error as Error).name);
	}
}

export function scheduleWebhookDispatch(
	db: D1Database,
	context: WebhookFilterContext & { payload: WebhookPayload },
	waitUntil?: (promise: Promise<unknown>) => void,
): void {
	const work = dispatchWebhooks(db, context);
	if (waitUntil) {
		waitUntil(work);
	} else {
		void work;
	}
}
