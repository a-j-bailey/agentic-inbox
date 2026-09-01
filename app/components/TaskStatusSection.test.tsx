// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DONNA_ID, DONNA_NAME, type Task } from "shared/tasks";
import TaskStatusSection from "./TaskStatusSection";

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "task-1",
		title: "Triage inbound",
		description: "",
		status: "pending",
		assignee_name: DONNA_NAME,
		assignee_id: DONNA_ID,
		created_by: "Adam",
		updated_by: "Adam",
		blocked_reason: null,
		mailbox_id: null,
		email_id: null,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		started_at: null,
		completed_at: null,
		blocked_at: null,
		deleted_at: null,
		...overrides,
	};
}

describe("TaskStatusSection", () => {
	it("shows status name, count, and cards when expanded", () => {
		const html = renderToStaticMarkup(
			<TaskStatusSection
				status="pending"
				tasks={[task()]}
				collapsed={false}
				onToggle={() => {}}
				onDropTask={() => {}}
				onSelectTask={() => {}}
			/>,
		);
		expect(html).toContain("Pending");
		expect(html).toContain("Triage inbound");
		expect(html).toContain('aria-expanded="true"');
		expect(html).toContain("Pending (1)");
	});

	it("hides cards when collapsed", () => {
		const html = renderToStaticMarkup(
			<TaskStatusSection
				status="pending"
				tasks={[task()]}
				collapsed={true}
				onToggle={() => {}}
				onDropTask={() => {}}
				onSelectTask={() => {}}
			/>,
		);
		expect(html).toContain("Pending");
		expect(html).toContain('aria-expanded="false"');
		expect(html).not.toContain("Triage inbound");
	});
});
