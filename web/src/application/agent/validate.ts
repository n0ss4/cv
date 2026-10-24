// A minimal JSON Schema validator for the subset prompts/schemas.ts uses.
//
// Constrained decoding should already make the model's output conform, but the
// page must not trust that: a malformed answer is caught here, sent back to the
// model once with the error, and otherwise reported as a failed step.
// Returns null when valid, or the first error as "path: message".

import type { Schema } from "../prompts/schemas";

export function validate(schema: Schema, value: unknown, path = "$"): string | null {
	if (schema.type === "object") {
		if (!value || typeof value !== "object" || Array.isArray(value)) return `${path}: expected an object`;
		const obj = value as Record<string, unknown>;
		for (const key of schema.required ?? []) if (!(key in obj)) return `${path}.${key}: is required`;
		for (const [key, v] of Object.entries(obj)) {
			const sub = schema.properties?.[key];
			if (!sub) {
				if (schema.additionalProperties === false) return `${path}.${key}: is not allowed`;
				continue;
			}
			const err = validate(sub, v, `${path}.${key}`);
			if (err) return err;
		}
		return null;
	}
	if (schema.type === "array") {
		if (!Array.isArray(value)) return `${path}: expected an array`;
		if (schema.maxItems != null && value.length > schema.maxItems) return `${path}: at most ${schema.maxItems} items`;
		for (let i = 0; i < value.length; i++) {
			const err = validate(schema.items!, value[i], `${path}[${i}]`);
			if (err) return err;
		}
		return null;
	}
	if (schema.type === "string") {
		if (typeof value !== "string") return `${path}: expected a string`;
		if (schema.maxLength != null && value.length > schema.maxLength) return `${path}: at most ${schema.maxLength} characters`;
		if (schema.pattern && !new RegExp(schema.pattern).test(value)) return `${path}: must match ${schema.pattern}`;
	} else if (schema.type === "integer") {
		if (!Number.isInteger(value)) return `${path}: expected an integer`;
		const n = value as number;
		if (schema.minimum != null && n < schema.minimum) return `${path}: at least ${schema.minimum}`;
		if (schema.maximum != null && n > schema.maximum) return `${path}: at most ${schema.maximum}`;
	} else if (schema.type === "boolean") {
		if (typeof value !== "boolean") return `${path}: expected true or false`;
	}
	if (schema.enum && !schema.enum.includes(value as string)) return `${path}: must be one of ${schema.enum.join(", ")}`;
	return null;
}

// Gemini Nano is occasionally semantically correct but mechanically loose:
// null instead of an empty string or list, a single object instead of a list,
// overlong text, or one malformed item in an otherwise useful array. Repair only transformations that cannot invent a
// fact. Irreparable array items are discarded; missing required top-level data
// still fails normal validation and triggers the retry path.
const DROP = Symbol("drop");

function repaired(schema: Schema, value: unknown): unknown {
	if (schema.type === "object") {
		if (!value || typeof value !== "object" || Array.isArray(value)) return DROP;
		const obj = value as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const [key, sub] of Object.entries(schema.properties ?? {})) {
			if (!(key in obj)) {
				if (schema.required?.includes(key)) return DROP;
				continue;
			}
			const child = repaired(sub, obj[key]);
			if (child === DROP) {
				if (schema.required?.includes(key)) return DROP;
				continue;
			}
			out[key] = child;
		}
		return out;
	}
	if (schema.type === "array") {
		// null is "none found"; a lone item where a list was asked for is that item.
		if (value == null) value = [];
		else if (!Array.isArray(value) && schema.items?.type === "object" && typeof value === "object") value = [value];
		if (!Array.isArray(value)) return DROP;
		const out: unknown[] = [];
		for (const item of value.slice(0, schema.maxItems ?? value.length)) {
			const child = repaired(schema.items!, item);
			if (child !== DROP) out.push(child);
		}
		return out;
	}
	if (schema.type === "string") {
		let out: unknown = value == null ? "" : value;
		if (typeof out === "number" || typeof out === "boolean") out = String(out);
		if (typeof out !== "string") return DROP;
		let s = out;
		if (schema.maxLength != null) s = s.slice(0, schema.maxLength);
		if (schema.pattern && !new RegExp(schema.pattern).test(s)) return DROP;
		if (schema.enum && !schema.enum.includes(s)) return DROP;
		return s;
	}
	if (schema.type === "boolean") {
		if (value === true || value === false) return value;
		if (value === "true") return true;
		if (value === "false") return false;
		return DROP;
	}
	if (schema.type === "integer") {
		const out = typeof value === "string" && /^-?\d+$/.test(value) ? Number(value) : value;
		if (!Number.isInteger(out)) return DROP;
		const n = out as number;
		if (schema.minimum != null && n < schema.minimum) return DROP;
		if (schema.maximum != null && n > schema.maximum) return DROP;
		return n;
	}
	return schema.enum && !schema.enum.includes(value as string) ? DROP : value;
}

export function repair(schema: Schema, value: unknown): unknown {
	const result = repaired(schema, value);
	return result === DROP ? value : result;
}
