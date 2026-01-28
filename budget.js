import { createClient } from "@supabase/supabase-js";

  const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "https://kjqllxvfdmndawoettoi.supabase.co";
  const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "sb_publishable_L6a3FA_sxA0pRYouRPHN6A_zZ_26T0o";

  const supabase = (() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  })();

  function isLocalhost() {
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  }

  function getLoginPath() {
    return "/";
  }

  function getAppPath() {
    return isLocalhost() ? "/app.html" : "/app";
  }

  const provinces = [
    "Regional Office",
    "Bukidnon",
    "Camiguin",
    "Lanao del Norte",
    "Misamis Occidental",
    "Misamis Oriental",
  ];

  const el = {
    budgetTitle: document.getElementById("budgetTitle"),
    budgetOverviewTbody: document.getElementById("budgetOverviewTbody"),
    expenseDeductionsTbody: document.getElementById("expenseDeductionsTbody"),
    expenseDeductionsFilter: document.getElementById("expenseDeductionsFilter"),
    btnDownload: document.getElementById("btnDownload"),
    btnBack: document.getElementById("btnBack"),
  };

  function money(n) {
    const num = Number(n) || 0;
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getBudgetFromURL() {
    const params = new URLSearchParams(window.location.search);
    return {
      budgetCode: params.get("budget"),
      category: params.get("category"),
    };
  }

  async function loadExpensesFromDb() {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("expenses")
      .select("id, object_of_expenditure, province, budget_code, expense_amount")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data || []).map((row) => ({
      objectOfExpenditure: row.object_of_expenditure,
      province: row.province,
      budgetCode: row.budget_code,
      expenseAmount: Number(row.expense_amount) || 0,
    }));
  }

  async function loadBudgetInputsFromDb() {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("budget_inputs")
      .select("id, object_of_expenditure, province, budget_code, proposed_amount")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data || []).map((row) => ({
      objectOfExpenditure: row.object_of_expenditure,
      province: row.province,
      budgetCode: row.budget_code,
      proposedAmount: Number(row.proposed_amount) || 0,
    }));
  }

  function computeSpent(exp) {
    const expense = Number(exp.expenseAmount) || 0;
    return expense;
  }

  async function loadBudgetTransfersFromDb() {
    const { data, error } = await supabase
      .from("budget_transfers")
      .select("from_object,from_province,from_budget,to_object,to_province,to_budget,amount,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((row) => ({
      fromObject: row.from_object,
      fromProvince: row.from_province,
      fromBudget: row.from_budget,
      toObject: row.to_object,
      toProvince: row.to_province,
      toBudget: row.to_budget,
      amount: Number(row.amount) || 0,
      createdAt: row.created_at,
    }));
  }

  function formatSignedMoney(n) {
    const num = Number(n) || 0;
    const abs = Math.abs(num);
    const prefix = num > 0 ? "+" : num < 0 ? "-" : "";
    return prefix + money(abs);
  }

  function formatTransferBreakdown({ transferIn, transferOut }) {
    const parts = [];
    if (Number(transferIn) > 0) parts.push(`<span class="transfer-plus">(+${money(transferIn)})</span>`);
    if (Number(transferOut) > 0) parts.push(`<span class="transfer-minus">(-${money(transferOut)})</span>`);
    if (parts.length === 0) return "";
    return parts.join(" ");
  }

  function csvEscape(v) {
    const s = String(v ?? "");
    if (/[\n\r",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function toCsv(rows) {
    return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  }

  function downloadTextFile({ filename, content, mime }) {
    const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function htmlEscape(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildHtmlTable({ title, headers, rows }) {
    const thead = `
      <thead>
        <tr>
          ${headers.map((h) => `<th>${htmlEscape(h)}</th>`).join("")}
        </tr>
      </thead>`;

    const tbody = `
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            ${r.map((c) => `<td>${htmlEscape(c)}</td>`).join("")}
          </tr>`
          )
          .join("")}
      </tbody>`;

    return `
      <h2>${htmlEscape(title)}</h2>
      <table>
        ${thead}
        ${tbody}
      </table>`;
  }

  function buildExcelHtml({ sheetName, bodyHtml }) {
    return `
      <html xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:x="urn:schemas-microsoft-com:office:excel"
            xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>${htmlEscape(sheetName)}</x:Name>
                  <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <style>
            body { font-family: Arial, sans-serif; }
            h2 { margin: 16px 0 8px; font-size: 14pt; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 18px; table-layout: fixed; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
            th { background: #1e3a8a; color: #ffffff; font-weight: 700; }
            td.num { text-align: right; }
            .meta { margin-bottom: 10px; }
            .meta td { border: none; padding: 2px 0; }
          </style>
        </head>
        <body>
          ${bodyHtml}
        </body>
      </html>`;
  }

  function buildBudgetOverviewRows({ budgetCode, category, expenses, budgetInputs, transfers }) {
    const relevantTransfers = (transfers || []).filter(
      (t) =>
        (t.fromObject === category && t.fromBudget === budgetCode) ||
        (t.toObject === category && t.toBudget === budgetCode)
    );

    const rows = [];
    for (const province of provinces) {
      const matchedExpenses = (expenses || []).filter(
        (e) => e.objectOfExpenditure === category && e.budgetCode === budgetCode && e.province === province
      );
      const matchedBudgets = (budgetInputs || []).filter(
        (b) => b.objectOfExpenditure === category && b.budgetCode === budgetCode && b.province === province
      );

      const transferIn = relevantTransfers
        .filter((t) => t.toObject === category && t.toBudget === budgetCode && t.toProvince === province)
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const transferOut = relevantTransfers
        .filter((t) => t.fromObject === category && t.fromBudget === budgetCode && t.fromProvince === province)
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

      const allocated = matchedBudgets.reduce((sum, b) => sum + (Number(b.proposedAmount) || 0), 0);
      const spent = matchedExpenses.reduce((sum, e) => sum + computeSpent(e), 0);
      const remaining = allocated - spent;

      let status = "Within Budget";
      if (allocated === 0 && spent === 0) status = "";
      else if (remaining < 0) status = "Over Budget";
      else if (remaining === 0) status = "Budget Met";

      rows.push({
        province,
        allocated,
        transferIn,
        transferOut,
        spent,
        remaining,
        status,
      });
    }
    return rows;
  }

  function renderBudgetOverview({ budgetCode, category, expenses, budgetInputs, transfers }) {
    el.budgetOverviewTbody.innerHTML = "";

    const relevantTransfers = (transfers || []).filter(
      (t) =>
        (t.fromObject === category && t.fromBudget === budgetCode) ||
        (t.toObject === category && t.toBudget === budgetCode)
    );

    for (const province of provinces) {
      const matchedExpenses = expenses.filter(
        (e) => e.objectOfExpenditure === category && e.budgetCode === budgetCode && e.province === province
      );
      const matchedBudgets = budgetInputs.filter(
        (b) => b.objectOfExpenditure === category && b.budgetCode === budgetCode && b.province === province
      );

      const transferIn = relevantTransfers
        .filter((t) => t.toObject === category && t.toBudget === budgetCode && t.toProvince === province)
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const transferOut = relevantTransfers
        .filter((t) => t.fromObject === category && t.fromBudget === budgetCode && t.fromProvince === province)
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
      const transferNet = transferIn - transferOut;

      const allocated = matchedBudgets.reduce((sum, b) => sum + (Number(b.proposedAmount) || 0), 0);
      const spent = matchedExpenses.reduce((sum, e) => sum + computeSpent(e), 0);
      const remaining = allocated - spent;

      let status = "Within Budget";
      let statusClass = "status-good";

      if (allocated === 0 && spent === 0) {
        status = "";
        statusClass = "";
      } else if (remaining < 0) {
        status = "Over Budget";
        statusClass = "status-danger";
      } else if (remaining === 0) {
        status = "Budget Met";
        statusClass = "status-warning";
      }

      const tr = document.createElement("tr");
      const transferBreakdown = formatTransferBreakdown({ transferIn, transferOut });
      const allocatedCell =
        transferNet === 0
          ? `${money(allocated)}`
          : `${money(allocated)} ${transferBreakdown}`;
      tr.innerHTML = `
        <td>${province}</td>
        <td class="num">${allocatedCell}</td>
        <td class="num">${money(spent)}</td>
        <td class="num">${money(remaining)}</td>
        <td class="${statusClass}">${status}</td>
      `;
      el.budgetOverviewTbody.appendChild(tr);
    }
  }

  function renderExpenseDeductions({ budgetCode, category, expenses, provinceFilter }) {
    if (!el.expenseDeductionsTbody) return;
    el.expenseDeductionsTbody.innerHTML = "";

    const rows = (expenses || [])
      .filter((e) => e.objectOfExpenditure === category && e.budgetCode === budgetCode)
      .filter((e) => (!provinceFilter ? true : e.province === provinceFilter))
      .filter((e) => Number(e.expenseAmount) > 0)
      .slice();

    rows.sort((a, b) => {
      const ka = `${a.province || ""}|${a.expenseAmount || 0}`;
      const kb = `${b.province || ""}|${b.expenseAmount || 0}`;
      return ka.localeCompare(kb);
    });

    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 2;
      td.className = "muted";
      td.textContent = "No expenses yet.";
      tr.appendChild(td);
      el.expenseDeductionsTbody.appendChild(tr);
      return;
    }

    let total = 0;
    for (const e of rows) {
      const amt = Number(e.expenseAmount) || 0;
      total += amt;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${e.province || "-"}</td>
        <td class="num">${money(amt)}</td>
      `;
      el.expenseDeductionsTbody.appendChild(tr);
    }

    if (provinceFilter) {
      const trTotal = document.createElement("tr");
      trTotal.className = "detail-row";
      trTotal.innerHTML = `
        <td><strong>Total</strong></td>
        <td class="num"><strong>${money(total)}</strong></td>
      `;
      el.expenseDeductionsTbody.appendChild(trTotal);
    }
  }

  function sanitizeFilenamePart(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[^a-z0-9 \-_.]/gi, "")
      .replace(/\s/g, "_")
      .slice(0, 80);
  }

  async function init() {
    const { budgetCode, category } = getBudgetFromURL();
    if (!budgetCode || !category) {
      window.location.replace(getAppPath());
      return;
    }

    if (!supabase) {
      window.location.replace(getLoginPath());
      return;
    }

    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session?.user) {
      window.location.replace(getLoginPath());
      return;
    }

    el.budgetTitle.textContent = `Budget Overview - ${category} - ${budgetCode}`;

    const expenses = await loadExpensesFromDb();
    const budgetInputs = await loadBudgetInputsFromDb();
    let transfers = [];
    try {
      transfers = await loadBudgetTransfersFromDb();
    } catch (err) {
      // Ignore if the budget_transfers table hasn't been created yet.
      transfers = [];
    }
    renderBudgetOverview({ budgetCode, category, expenses, budgetInputs, transfers });

    if (el.btnDownload) {
      el.btnDownload.addEventListener("click", () => {
        const overviewRows = buildBudgetOverviewRows({ budgetCode, category, expenses, budgetInputs, transfers });
        const overviewTable = buildHtmlTable({
          title: "Budget Overview",
          headers: ["Province", "Budget", "Transfer In (+)", "Transfer Out (-)", "Expense", "Remaining", "Status"],
          rows: overviewRows.map((r) => [
            r.province,
            money(r.allocated),
            money(r.transferIn),
            money(r.transferOut),
            money(r.spent),
            money(r.remaining),
            r.status,
          ]),
        });

        const provinceFilter = el.expenseDeductionsFilter?.value || "";
        const expenseRows = (expenses || [])
          .filter((e) => e.objectOfExpenditure === category && e.budgetCode === budgetCode)
          .filter((e) => (!provinceFilter ? true : e.province === provinceFilter))
          .filter((e) => Number(e.expenseAmount) > 0)
          .slice();

        const expenseTable = buildHtmlTable({
          title: `Expense Deductions (${provinceFilter || "All Provinces"})`,
          headers: ["Province", "Expense Amount"],
          rows: expenseRows.map((e) => [e.province || "-", money(Number(e.expenseAmount) || 0)]),
        });

        const transferRows = (transfers || []).filter(
          (t) =>
            (t.fromObject === category && t.fromBudget === budgetCode) ||
            (t.toObject === category && t.toBudget === budgetCode)
        );

        const transfersTable = buildHtmlTable({
          title: "Budget Transfers (related to this budget line)",
          headers: [
            "Date",
            "From Object",
            "From Province",
            "From Budget",
            "To Object",
            "To Province",
            "To Budget",
            "Amount",
          ],
          rows: transferRows.map((t) => [
            t.createdAt ? new Date(t.createdAt).toLocaleString() : "",
            t.fromObject,
            t.fromProvince,
            t.fromBudget,
            t.toObject,
            t.toProvince,
            t.toBudget,
            money(Number(t.amount) || 0),
          ]),
        });

        const metaTable = `
          <table class="meta">
            <tr><td><strong>Category:</strong> ${htmlEscape(category)}</td></tr>
            <tr><td><strong>Budget Code:</strong> ${htmlEscape(budgetCode)}</td></tr>
            <tr><td><strong>Exported At:</strong> ${htmlEscape(new Date().toLocaleString())}</td></tr>
          </table>`;

        const sheetName = `${sanitizeFilenamePart(category)}_${sanitizeFilenamePart(budgetCode)}`.slice(0, 31);
        const html = buildExcelHtml({
          sheetName: sheetName || "BudgetOverview",
          bodyHtml: `${metaTable}${overviewTable}${expenseTable}${transfersTable}`,
        });

        const filename = `Budget_Overview_${sanitizeFilenamePart(category)}_${sanitizeFilenamePart(
          budgetCode
        )}.xls`;
        downloadTextFile({ filename, content: html, mime: "application/vnd.ms-excel;charset=utf-8" });
      });
    }

    if (el.expenseDeductionsFilter) {
      // Populate province filter options (keeps the existing "All Provinces" option).
      const existingValues = new Set(
        Array.from(el.expenseDeductionsFilter.options).map((o) => String(o.value))
      );
      for (const p of provinces) {
        if (existingValues.has(p)) continue;
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        el.expenseDeductionsFilter.appendChild(opt);
      }
    }

    const renderDeductions = () => {
      const provinceFilter = el.expenseDeductionsFilter?.value || "";
      renderExpenseDeductions({ budgetCode, category, expenses, provinceFilter });
    };

    renderDeductions();

    el.expenseDeductionsFilter?.addEventListener("change", () => {
      renderDeductions();
    });

    el.btnBack.addEventListener("click", () => {
      window.location.replace(getAppPath());
    });
  }

  init();
