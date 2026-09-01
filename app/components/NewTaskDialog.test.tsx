// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { describe, expect, it } from "vitest";
import { assigneeNameForCreate, DONNA_ASSIGNS_VALUE } from "./NewTaskDialog";
import { DONNA_NAME } from "shared/tasks";

describe("NewTaskDialog assignee default", () => {
	it("maps Donna assigns to an empty assignee so the server picks Donna", () => {
		expect(assigneeNameForCreate(DONNA_ASSIGNS_VALUE)).toBe("");
		expect(assigneeNameForCreate(DONNA_NAME)).toBe(DONNA_NAME);
	});
});
