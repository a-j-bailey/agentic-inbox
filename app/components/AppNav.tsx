// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Tabs } from "@cloudflare/kumo";
import { useLocation, useNavigate, useParams } from "react-router";

export default function AppNav() {
	const navigate = useNavigate();
	const location = useLocation();
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const isTasks = location.pathname === "/tasks" || location.pathname.startsWith("/tasks/");
	const section = isTasks ? "tasks" : "mail";
	const mailTo = mailboxId ? `/mailbox/${mailboxId}` : "/";

	return (
		<nav aria-label="App sections" data-active-section={section} className="shrink-0">
			<Tabs
				variant="segmented"
				value={section}
				activateOnFocus
				tabs={[
					{ value: "mail", label: "Mail" },
					{ value: "tasks", label: "Tasks" },
				]}
				onValueChange={(value) => {
					if (value === "tasks") {
						navigate("/tasks");
						return;
					}
					navigate(mailTo);
				}}
			/>
		</nav>
	);
}
