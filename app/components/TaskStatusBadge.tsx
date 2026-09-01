// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Badge, type BadgeVariant } from "@cloudflare/kumo";
import {
	assertNever,
	taskStatusLabel,
	type TaskStatus,
} from "shared/tasks";

export function taskStatusBadgeVariant(status: TaskStatus): BadgeVariant {
	switch (status) {
		case "pending":
			return "secondary";
		case "blocked":
			return "destructive";
		case "in_progress":
			return "primary";
		case "done":
			return "success";
		default:
			return assertNever(status);
	}
}

export default function TaskStatusBadge({ status }: { status: TaskStatus }) {
	return (
		<Badge variant={taskStatusBadgeVariant(status)}>
			{taskStatusLabel(status)}
		</Badge>
	);
}
