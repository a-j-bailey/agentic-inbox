// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TaskStatusBadge, { taskStatusBadgeVariant } from "./TaskStatusBadge";

describe("taskStatusBadgeVariant", () => {
	it("maps each status to a colored Kumo variant", () => {
		expect(taskStatusBadgeVariant("pending")).toBe("secondary");
		expect(taskStatusBadgeVariant("blocked")).toBe("destructive");
		expect(taskStatusBadgeVariant("in_progress")).toBe("primary");
		expect(taskStatusBadgeVariant("done")).toBe("success");
	});
});

describe("TaskStatusBadge", () => {
	it("renders human labels in a Kumo badge", () => {
		expect(renderToStaticMarkup(<TaskStatusBadge status="pending" />)).toContain(
			"Pending",
		);
		expect(renderToStaticMarkup(<TaskStatusBadge status="blocked" />)).toContain(
			"Blocked",
		);
		expect(
			renderToStaticMarkup(<TaskStatusBadge status="in_progress" />),
		).toContain("In progress");
		expect(renderToStaticMarkup(<TaskStatusBadge status="done" />)).toContain(
			"Done",
		);
		expect(
			renderToStaticMarkup(<TaskStatusBadge status="in_progress" />),
		).not.toContain("in_progress");
	});
});
