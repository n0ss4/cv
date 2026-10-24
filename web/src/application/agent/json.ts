// Getting a JSON value out of a small model's reply.

function salvageReview(raw: string): { findings: unknown[]; strengths: string[] } | null {
	const key = raw.indexOf('"findings"');
	const start = key < 0 ? -1 : raw.indexOf("[", key);
	if (start < 0) return null;
	const findings: unknown[] = [];
	let objectStart = -1;
	let depth = 0;
	let inString = false;
	let escaped = false;
	let arrayClosed = false;
	for (let i = start + 1; i < raw.length; i++) {
		const char = raw[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === '"') inString = false;
			continue;
		}
		if (char === '"') {
			inString = true;
			continue;
		}
		if (char === "{") {
			if (depth === 0) objectStart = i;
			depth++;
		} else if (char === "}" && depth > 0) {
			depth--;
			if (depth === 0 && objectStart >= 0) {
				try {
					findings.push(JSON.parse(raw.slice(objectStart, i + 1)));
				} catch {
					/* discard only this item */
				}
				objectStart = -1;
			}
		} else if (char === "]" && depth === 0) {
			arrayClosed = true;
			break;
		}
	}
	// A truncated fifth finding must not discard four complete findings. An
	// intact empty array is also a valid "nothing to report" review.
	return findings.length || arrayClosed ? { findings, strengths: [] } : null;
}

export function parseModelJSON(raw: unknown, task: string): unknown {
	const text = String(raw ?? "").trim();
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
	const candidate = fenced || text;
	try {
		return JSON.parse(candidate);
	} catch {
		const start = candidate.indexOf("{");
		const end = candidate.lastIndexOf("}");
		if (start >= 0 && end > start) {
			try {
				return JSON.parse(candidate.slice(start, end + 1));
			} catch {
				/* try task-specific recovery */
			}
		}
		if (task === "review") {
			const salvaged = salvageReview(candidate);
			if (salvaged) return salvaged;
		}
		throw new Error("the reply is not valid JSON");
	}
}
