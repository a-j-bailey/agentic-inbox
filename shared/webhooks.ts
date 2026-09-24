// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

export const WEBHOOK_EVENTS = ["email.received"] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function isWebhookEvent(value: string): value is WebhookEvent {
	return (WEBHOOK_EVENTS as readonly string[]).includes(value);
}

export interface WebhookSubscription {
	id: string;
	event: WebhookEvent;
	url: string;
	secret: string;
	mailbox_id: string | null;
	enabled: boolean;
	created_at: string;
}

export type EmailReceivedPayload = {
	event: "email.received";
	email_id: string;
	mailbox_id: string;
	mailbox_address: string;
	from: string;
	to: string;
	subject: string;
	thread_id: string;
	received_at: string;
};

export type WebhookPayload = EmailReceivedPayload;

export type WebhookFilterContext = {
	event: WebhookEvent;
	mailboxId?: string | null;
};

export type WebhookFilterRow = {
	event: string;
	enabled: boolean;
	mailbox_id: string | null;
};

export function webhookMatchesFilter(
	subscription: WebhookFilterRow,
	context: WebhookFilterContext,
): boolean {
	if (!subscription.enabled) return false;
	if (subscription.event !== context.event) return false;
	if (subscription.mailbox_id && subscription.mailbox_id !== context.mailboxId) {
		return false;
	}
	return true;
}

export function maskWebhookSecret(secret: string): string {
	if (secret.length <= 4) return "••••";
	return `••••${secret.slice(-4)}`;
}
