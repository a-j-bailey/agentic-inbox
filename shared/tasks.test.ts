// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { describe, expect, it } from "vitest";
import {
	DONNA_ID,
	DONNA_NAME,
	buildTaskTimeline,
	type Task,
	type TaskUpdate,
} from "./tasks";

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "task-1",
		title: "Triage inbound",
		description: "",
		status: "in_progress",
		assignee_name: DONNA_NAME,
		assignee_id: DONNA_ID,
		created_by: "Adam",
		updated_by: "Ponder",
		blocked_reason: null,
		mailbox_id: null,
		email_id: null,
		created_at: "2026-09-01T10:00:00.000Z",
		updated_at: "2026-09-01T10:20:00.000Z",
		started_at: "2026-09-01T10:05:00.000Z",
		completed_at: null,
		blocked_at: null,
		deleted_at: null,
		...overrides,
	};
}

describe("buildTaskTimeline", () => {
	it("orders created, status stamps, and bot updates by time", () => {
		const updates: TaskUpdate[] = [
			{
				id: "u1",
				task_id: "task-1",
				actor_name: "Ponder",
				body: "Pulled the parcel map",
				created_at: "2026-09-01T10:10:00.000Z",
			},
		];
		const items = buildTaskTimeline(task(), updates);
		expect(items.map((item) => item.kind)).toEqual([
			"created",
			"started",
			"update",
		]);
		expect(items[0]?.actor_name).toBe("Adam");
		expect(items[2]?.text).toBe("Pulled the parcel map");
	});
});
