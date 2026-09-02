// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Toasty } from "@cloudflare/kumo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { queryKeys } from "../queries/keys";
import WebhookSettings from "./WebhookSettings";

describe("WebhookSettings", () => {
	it("lists a masked secret and the add fields", () => {
		const qc = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		});
		qc.setQueryData(queryKeys.webhooks.all, {
			webhooks: [
				{
					id: "w1",
					event: "email.received",
					url: "https://bots.example/hook",
					secret: "••••oken",
					mailbox_id: "inbox@example.com",
					assignee: null,
					enabled: true,
					created_at: "2026-09-02T00:00:00.000Z",
				},
			],
		});
		const html = renderToStaticMarkup(
			<QueryClientProvider client={qc}>
				<Toasty>
					<WebhookSettings />
				</Toasty>
			</QueryClientProvider>,
		);
		expect(html).toContain("Webhooks");
		expect(html).toContain("email.received");
		expect(html).toContain("https://bots.example/hook");
		expect(html).toContain("••••oken");
		expect(html).toContain("Bearer token");
		expect(html).toContain("Mailbox (optional)");
		expect(html).toContain("Assignee (optional)");
		expect(html).not.toContain("No webhooks yet");
		expect(html).not.toContain("Get started");
	});
});
