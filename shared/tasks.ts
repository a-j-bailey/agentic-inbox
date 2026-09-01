// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

export const TASK_STATUSES = [
	"pending",
	"blocked",
	"in_progress",
	"done",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const DONNA_ID = "d905a2a4-4426-4cd7-ad19-183cf031d2e3";
export const DONNA_NAME = "Donna";
export const UI_ACTOR_NAME = "Adam";

export const DONE_HIDE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export interface Task {
	id: string;
	title: string;
	description: string;
	status: TaskStatus;
	assignee_name: string;
	assignee_id: string | null;
	created_by: string;
	updated_by: string;
	blocked_reason: string | null;
	mailbox_id: string | null;
	email_id: string | null;
	created_at: string;
	updated_at: string;
	started_at: string | null;
	completed_at: string | null;
	blocked_at: string | null;
	deleted_at: string | null;
}

export interface Agent {
	id: string;
	name: string;
}

export function isTaskStatus(value: string): value is TaskStatus {
	return (TASK_STATUSES as readonly string[]).includes(value);
}

export function assertNever(value: never): never {
	throw new Error(`Unexpected value: ${String(value)}`);
}

export function taskStatusLabel(status: TaskStatus): string {
	switch (status) {
		case "pending":
			return "Pending";
		case "blocked":
			return "Blocked";
		case "in_progress":
			return "In progress";
		case "done":
			return "Done";
		default:
			return assertNever(status);
	}
}
