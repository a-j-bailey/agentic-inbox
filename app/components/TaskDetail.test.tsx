// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DONNA_ID, DONNA_NAME, type Task } from "shared/tasks";
import TaskDetail from "./TaskDetail";

function task(overrides: Partial<Task> = {}): Task {
	return {
		id: "task-1",
		title: "Triage inbound",
		description: "",
		status: "in_progress",
		assignee_name: "Ponder",
		assignee_id: DONNA_ID,
		created_by: "Adam",
		updated_by: "Ponder",
		blocked_reason: null,
		mailbox_id: null,
		email_id: null,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		started_at: new Date().toISOString(),
		completed_at: null,
		blocked_at: null,
		deleted_at: null,
		...overrides,
	};
}

describe("TaskDetail", () => {
	it("uses native selects with human status labels", () => {
		const html = renderToStaticMarkup(
			<TaskDetail
				task={task()}
				updates={[]}
				agents={[
					{ id: DONNA_ID, name: DONNA_NAME },
					{ id: "ponder", name: "Ponder" },
				]}
				onClose={() => {}}
				onSave={async () => {}}
				onDelete={async () => {}}
				onAddUpdate={async () => {}}
			/>,
		);
		expect(html).toContain("<select");
		expect(html).toContain(">In progress</option>");
		expect(html).not.toContain(">in_progress</option>");
		expect(html).toContain("Created by Adam");
		expect(html).toContain("Add an update");
	});
});
