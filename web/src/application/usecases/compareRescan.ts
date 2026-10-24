import { diffReports, type RescanDiff } from "@domain/rescan/diff";
import type { Report } from "@domain/report/report";

const summary = (r: Report) => ({ verdict: r.verdict, overall: r.overall, fileName: r.document.fileName, findings: r.findings });

export function compareRescan(previous: Report, current: Report): RescanDiff {
	return diffReports(summary(previous), summary(current));
}
