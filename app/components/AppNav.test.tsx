// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import AppNav from "./AppNav";

function renderAt(path: string) {
	return renderToStaticMarkup(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route path="/" element={<AppNav />} />
				<Route path="/tasks" element={<AppNav />} />
				<Route path="/mailbox/:mailboxId" element={<AppNav />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("AppNav", () => {
	it("shows Mail and Tasks tabs on home", () => {
		const html = renderAt("/");
		expect(html).toContain("Mail");
		expect(html).toContain("Tasks");
		expect(html).toContain('data-active-section="mail"');
	});

	it("shows Mail and Tasks tabs on /tasks", () => {
		const html = renderAt("/tasks");
		expect(html).toContain("Mail");
		expect(html).toContain("Tasks");
		expect(html).toContain('data-active-section="tasks"');
	});
});
