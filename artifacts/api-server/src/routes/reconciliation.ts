import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  bankStatementsTable, bankStatementEntriesTable,
  cashbookEntriesTable, reconciliationReportsTable
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";

const router: IRouter = Router();

// ─── CSV Parsing ───────────────────────────────────────────────────────────
interface ParsedEntry {
  date: string; description: string;
  credit: string; debit: string;
  balance: string; referenceNo: string;
}

function normalizeDate(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Try YYYY-MM-DD or MM/DD/YYYY
  const ymd = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Try "01 Jan 2026" or "Jan 01, 2026"
  const months: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
  const dmy2 = trimmed.match(/^(\d{1,2})\s+([a-z]{3})\s+(\d{4})$/i);
  if (dmy2) {
    const [, d, mon, y] = dmy2;
    return `${y}-${months[mon.toLowerCase()] ?? "01"}-${d.padStart(2, "0")}`;
  }
  const mdy = trimmed.match(/^([a-z]{3})\s+(\d{1,2})[,]?\s+(\d{4})$/i);
  if (mdy) {
    const [, mon, d, y] = mdy;
    return `${y}-${months[mon.toLowerCase()] ?? "01"}-${d.padStart(2, "0")}`;
  }
  return trimmed;
}

function parseAmount(raw: string): string {
  if (!raw) return "0";
  const cleaned = raw.replace(/[₹$£€,\s]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? "0" : Math.abs(num).toFixed(2);
}

function detectColumn(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(h => h.toLowerCase().includes(candidate.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseCSV(text: string): ParsedEntry[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Find header row
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes("date") || lower.includes("amount") || lower.includes("credit") || lower.includes("debit")) {
      headerIdx = i;
      break;
    }
  }
  const rawHeaders = lines[headerIdx].split(",").map(h => h.replace(/["']/g, "").trim());

  const colDate = detectColumn(rawHeaders, ["date", "txn date", "value date", "transaction date", "posting date"]);
  const colDesc = detectColumn(rawHeaders, ["description", "narration", "particulars", "details", "remarks", "payee"]);
  const colCredit = detectColumn(rawHeaders, ["credit", "deposit", "cr", "receipt", "in"]);
  const colDebit = detectColumn(rawHeaders, ["debit", "withdrawal", "dr", "payment", "out"]);
  const colAmount = detectColumn(rawHeaders, ["amount", "transaction amount"]);
  const colBalance = detectColumn(rawHeaders, ["balance", "closing balance", "running balance"]);
  const colRef = detectColumn(rawHeaders, ["ref", "reference", "chq", "cheque", "transaction id", "txn id"]);

  const entries: ParsedEntry[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    // Handle quoted CSV fields
    const cols: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { cols.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    cols.push(current.trim());

    const dateRaw = colDate >= 0 ? cols[colDate] ?? "" : "";
    const date = normalizeDate(dateRaw);
    if (!date) continue;

    let credit = "0", debit = "0";
    if (colCredit >= 0 && colDebit >= 0) {
      credit = parseAmount(cols[colCredit] ?? "");
      debit = parseAmount(cols[colDebit] ?? "");
    } else if (colAmount >= 0) {
      const amt = parseFloat(parseAmount(cols[colAmount] ?? "")) || 0;
      const raw = cols[colAmount] ?? "";
      if (raw.startsWith("-") || raw.toLowerCase().includes("dr")) debit = Math.abs(amt).toFixed(2);
      else credit = Math.abs(amt).toFixed(2);
    }
    const description = colDesc >= 0 ? (cols[colDesc] ?? "").replace(/"/g, "") : "";
    const balance = colBalance >= 0 ? parseAmount(cols[colBalance] ?? "") : "";
    const referenceNo = colRef >= 0 ? (cols[colRef] ?? "").replace(/"/g, "") : "";
    entries.push({ date, description, credit, debit, balance, referenceNo });
  }
  return entries;
}

function parsePDFText(text: string): ParsedEntry[] {
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const entries: ParsedEntry[] = [];

  // Pattern: date-like token followed by amount tokens
  const datePattern = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\b/;
  const amountPattern = /[\d,]+\.\d{2}/g;

  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const date = normalizeDate(dateMatch[0]);
    if (!date) continue;

    const amounts = Array.from(line.matchAll(amountPattern)).map(m => m[0].replace(/,/g, ""));
    if (amounts.length === 0) continue;

    const desc = line.replace(datePattern, "").replace(/[\d,]+\.\d{2}/g, "").replace(/\s+/g, " ").trim();
    let credit = "0", debit = "0", balance = "";
    if (amounts.length >= 3) {
      debit = parseAmount(amounts[0]);
      credit = parseAmount(amounts[1]);
      balance = parseAmount(amounts[2]);
    } else if (amounts.length === 2) {
      credit = parseAmount(amounts[0]);
      balance = parseAmount(amounts[1]);
    } else if (amounts.length === 1) {
      credit = parseAmount(amounts[0]);
    }
    entries.push({ date, description: desc, credit, debit, balance, referenceNo: "" });
  }
  return entries;
}

// ─── Reconciliation Algorithm ──────────────────────────────────────────────
function dateDiff(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db2 = new Date(b).getTime();
  if (isNaN(da) || isNaN(db2)) return Infinity;
  return Math.abs((da - db2) / (1000 * 60 * 60 * 24));
}

function reconcile(bankEntries: any[], cashbookEntries: any[], toleranceDays = 3, amountTolerance = 0.01) {
  const cashbookUsed = new Set<number>();
  const matched: any[] = [];
  const unmatchedBank: any[] = [];

  for (const bank of bankEntries) {
    const bCredit = parseFloat(bank.credit) || 0;
    const bDebit = parseFloat(bank.debit) || 0;
    let found = false;

    for (let i = 0; i < cashbookEntries.length; i++) {
      if (cashbookUsed.has(i)) continue;
      const cb = cashbookEntries[i];
      const cbCredit = parseFloat(cb.credit) || 0;
      const cbDebit = parseFloat(cb.debit) || 0;
      const days = dateDiff(bank.date, cb.date);
      if (days > toleranceDays) continue;

      const creditMatch = bCredit > 0 && cbCredit > 0 && Math.abs(bCredit - cbCredit) <= amountTolerance;
      const debitMatch = bDebit > 0 && cbDebit > 0 && Math.abs(bDebit - cbDebit) <= amountTolerance;
      if (creditMatch || debitMatch) {
        cashbookUsed.add(i);
        matched.push({ bank, cashbook: cb, dateDiff: Math.round(days), type: creditMatch ? "credit" : "debit" });
        found = true;
        break;
      }
    }
    if (!found) unmatchedBank.push(bank);
  }

  const unmatchedCashbook = cashbookEntries.filter((_, i) => !cashbookUsed.has(i));
  return { matched, unmatchedBank, unmatchedCashbook };
}

// ─── Bank Statement Upload & Parse ────────────────────────────────────────
router.post("/bank-statements", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser.tenantId;
    const { fileName, fileType, fileData, bankName, accountNumber, period } = req.body;

    if (!fileData) { res.status(400).json({ message: "No file data provided" }); return; }

    const buffer = Buffer.from(fileData, "base64");
    let entries: ParsedEntry[] = [];

    if (fileType === "csv" || fileName?.toLowerCase().endsWith(".csv")) {
      const text = buffer.toString("utf-8");
      entries = parseCSV(text);
    } else if (fileType === "pdf" || fileName?.toLowerCase().endsWith(".pdf")) {
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(buffer);
        entries = parsePDFText(data.text);
      } catch (pdfErr) {
        console.error("PDF parse error:", pdfErr);
        res.status(400).json({ message: "Could not parse PDF. Please export your bank statement as CSV and try again." });
        return;
      }
    } else {
      res.status(400).json({ message: "Unsupported file type. Please upload CSV or PDF." });
      return;
    }

    if (entries.length === 0) {
      res.status(400).json({ message: "No transactions found in the file. Check the format and try again." });
      return;
    }

    const totalCredits = entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0).toFixed(2);
    const totalDebits = entries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0).toFixed(2);

    const [stmt] = await db.insert(bankStatementsTable).values({
      tenantId, fileName, fileType: fileType ?? "csv",
      bankName, accountNumber, period,
      totalEntries: entries.length,
      totalCredits, totalDebits,
      uploadedById: authUser.id,
    }).returning();

    const toInsert = entries.map(e => ({ ...e, statementId: stmt.id, tenantId }));
    if (toInsert.length > 0) {
      await db.insert(bankStatementEntriesTable).values(toInsert);
    }

    res.status(201).json({ statement: stmt, entriesCount: entries.length, sample: entries.slice(0, 5) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/bank-statements", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const stmts = await db.select().from(bankStatementsTable)
      .where(eq(bankStatementsTable.tenantId, authUser.tenantId))
      .orderBy(desc(bankStatementsTable.createdAt));
    res.json(stmts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/bank-statements/:id/entries", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [stmt] = await db.select().from(bankStatementsTable)
      .where(and(eq(bankStatementsTable.id, Number(req.params.id)), eq(bankStatementsTable.tenantId, authUser.tenantId))).limit(1);
    if (!stmt) { res.status(404).json({ message: "Statement not found" }); return; }
    const entries = await db.select().from(bankStatementEntriesTable)
      .where(eq(bankStatementEntriesTable.statementId, stmt.id));
    res.json({ statement: stmt, entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/bank-statements/:id", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    await db.delete(bankStatementEntriesTable).where(eq(bankStatementEntriesTable.statementId, Number(req.params.id)));
    await db.delete(bankStatementsTable)
      .where(and(eq(bankStatementsTable.id, Number(req.params.id)), eq(bankStatementsTable.tenantId, authUser.tenantId)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Cashbook Entries ──────────────────────────────────────────────────────
router.get("/cashbook", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const entries = await db.select().from(cashbookEntriesTable)
      .where(eq(cashbookEntriesTable.tenantId, authUser.tenantId))
      .orderBy(desc(cashbookEntriesTable.date));
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/cashbook", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser.tenantId;
    const { entries, fileData, fileName } = req.body;

    if (fileData) {
      const buffer = Buffer.from(fileData, "base64");
      const text = buffer.toString("utf-8");
      const parsed = parseCSV(text);
      if (parsed.length === 0) { res.status(400).json({ message: "No entries found in CSV" }); return; }
      const toInsert = parsed.map(e => ({ ...e, tenantId, entrySource: "upload" }));
      const inserted = await db.insert(cashbookEntriesTable).values(toInsert).returning();
      res.status(201).json({ count: inserted.length, entries: inserted });
      return;
    }

    if (Array.isArray(entries)) {
      const toInsert = entries.map((e: any) => ({
        tenantId, date: normalizeDate(e.date) || e.date,
        description: e.description, credit: parseAmount(e.credit || "0"),
        debit: parseAmount(e.debit || "0"), referenceNo: e.referenceNo,
        category: e.category, entrySource: "manual",
      }));
      const inserted = await db.insert(cashbookEntriesTable).values(toInsert).returning();
      res.status(201).json({ count: inserted.length, entries: inserted });
      return;
    }

    const single = req.body;
    const [entry] = await db.insert(cashbookEntriesTable).values({
      tenantId, date: normalizeDate(single.date) || single.date,
      description: single.description, credit: parseAmount(single.credit || "0"),
      debit: parseAmount(single.debit || "0"), referenceNo: single.referenceNo,
      category: single.category, entrySource: "manual",
    }).returning();
    res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/cashbook/:id", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    await db.delete(cashbookEntriesTable)
      .where(and(eq(cashbookEntriesTable.id, Number(req.params.id)), eq(cashbookEntriesTable.tenantId, authUser.tenantId)));
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Generate Reconciliation Report ───────────────────────────────────────
router.post("/generate-report", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const tenantId = authUser.tenantId;
    const { statementId, reportName, period, toleranceDays = 3 } = req.body;

    const bankEntries = statementId
      ? await db.select().from(bankStatementEntriesTable).where(eq(bankStatementEntriesTable.statementId, Number(statementId)))
      : await db.select().from(bankStatementEntriesTable).where(eq(bankStatementEntriesTable.tenantId, tenantId));

    const cashbookEntries = await db.select().from(cashbookEntriesTable)
      .where(eq(cashbookEntriesTable.tenantId, tenantId));

    const { matched, unmatchedBank, unmatchedCashbook } = reconcile(bankEntries, cashbookEntries, toleranceDays);

    const totalBankCredits = bankEntries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0).toFixed(2);
    const totalBankDebits = bankEntries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0).toFixed(2);
    const totalCashbookCredits = cashbookEntries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0).toFixed(2);
    const totalCashbookDebits = cashbookEntries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0).toFixed(2);
    const differenceCredits = (parseFloat(totalBankCredits) - parseFloat(totalCashbookCredits)).toFixed(2);
    const differenceDebits = (parseFloat(totalBankDebits) - parseFloat(totalCashbookDebits)).toFixed(2);

    const reportData = JSON.stringify({ matched, unmatchedBank, unmatchedCashbook });

    const [report] = await db.insert(reconciliationReportsTable).values({
      tenantId, statementId: statementId ? Number(statementId) : null,
      reportName: reportName || `Reconciliation - ${new Date().toLocaleDateString("en-IN")}`,
      period, matchedCount: matched.length,
      unmatchedBankCount: unmatchedBank.length,
      unmatchedCashbookCount: unmatchedCashbook.length,
      totalBankCredits, totalBankDebits,
      totalCashbookCredits, totalCashbookDebits,
      differenceCredits, differenceDebits, reportData,
      generatedById: authUser.id,
    }).returning();

    res.status(201).json({ report, matched, unmatchedBank, unmatchedCashbook });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/reports", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const reports = await db.select().from(reconciliationReportsTable)
      .where(eq(reconciliationReportsTable.tenantId, authUser.tenantId))
      .orderBy(desc(reconciliationReportsTable.createdAt));
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/reports/:id", requireAuth, requireRole("super_admin", "org_admin"), async (req, res) => {
  try {
    const authUser = (req as any).user;
    const [report] = await db.select().from(reconciliationReportsTable)
      .where(and(eq(reconciliationReportsTable.id, Number(req.params.id)), eq(reconciliationReportsTable.tenantId, authUser.tenantId))).limit(1);
    if (!report) { res.status(404).json({ message: "Report not found" }); return; }
    res.json({ report, data: JSON.parse(report.reportData || "{}") });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
