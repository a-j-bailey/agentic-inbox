// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import Header from "./Header";

function renderHeaderAt(path: string) {
	return renderToStaticMarkup(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route path="/" element={<Header />} />
				<Route path="/tasks" element={<Header />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("Header app tabs", () => {
	it("shows Mail and Tasks tabs on /", () => {
		const html = renderHeaderAt("/");
		expect(html).toContain("Mail");
		expect(html).toContain("Tasks");
		expect(html).toContain('data-active-section="mail"');
		expect(html).not.toContain("Search emails");
	});

	it("shows Mail and Tasks tabs on /tasks", () => {
		const html = renderHeaderAt("/tasks");
		expect(html).toContain("Mail");
		expect(html).toContain("Tasks");
		expect(html).toContain('data-active-section="tasks"');
		expect(html).not.toContain("Search emails");
	});
});
