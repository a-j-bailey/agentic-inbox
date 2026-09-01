// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DONNA_ID, DONNA_NAME } from "shared/tasks";
import TaskBoardHeader, {
	DEFAULT_ASSIGNEE_FILTER,
	taskFiltersActive,
} from "./TaskBoardHeader";

function renderHeader(
	overrides: Partial<{
		assigneeFilter: string;
		hideOldDone: boolean;
	}> = {},
) {
	return renderToStaticMarkup(
		<TaskBoardHeader
			agents={[{ id: DONNA_ID, name: DONNA_NAME }]}
			assigneeFilter={overrides.assigneeFilter ?? DEFAULT_ASSIGNEE_FILTER}
			hideOldDone={overrides.hideOldDone ?? true}
			onAssigneeFilterChange={() => {}}
			onHideOldDoneChange={() => {}}
			onNewTask={() => {}}
			onRefresh={() => {}}
			refreshing={false}
		/>,
	);
}

describe("taskFiltersActive", () => {
	it("is inactive for All and hide-old-done on", () => {
		expect(taskFiltersActive(DEFAULT_ASSIGNEE_FILTER, true)).toBe(false);
	});

	it("is active when assignee is not All or hide-old-done is off", () => {
		expect(taskFiltersActive(DONNA_NAME, true)).toBe(true);
		expect(taskFiltersActive(DEFAULT_ASSIGNEE_FILTER, false)).toBe(true);
	});
});

describe("TaskBoardHeader", () => {
	it("matches the Mailboxes title scale and primary action", () => {
		const html = renderHeader();
		expect(html).toContain("text-2xl font-bold text-kumo-default");
		expect(html).toContain("Tasks");
		expect(html).toContain("text-sm text-kumo-subtle mt-1");
		expect(html).toContain("Shared across mailboxes");
		expect(html).toContain("New task");
		expect(html).toContain("Filter");
		expect(html).toContain('aria-label="Refresh"');
	});

	it("keeps assignee All and hide-old-done out of the header row", () => {
		const html = renderHeader();
		expect(html).toContain('data-filters-active="false"');
		expect(html).not.toContain("aria-label=\"Filter by assignee\"");
		expect(html).not.toContain("Hide old done");
	});

	it("marks Filter when filters are not default", () => {
		const html = renderHeader({ assigneeFilter: DONNA_NAME, hideOldDone: false });
		expect(html).toContain('data-filters-active="true"');
	});
});
