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
