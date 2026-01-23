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
      .select("id, object_of_expenditure, province, budget_code, proposed_amount, expense_amount")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data || []).map((row) => ({
      objectOfExpenditure: row.object_of_expenditure,
      province: row.province,
      budgetCode: row.budget_code,
      proposedAmount: Number(row.proposed_amount) || 0,
      expenseAmount: Number(row.expense_amount) || 0,
    }));
  }

  function computeSpent(exp) {
    const proposed = Number(exp.proposedAmount) || 0;
    const expense = Number(exp.expenseAmount) || 0;
    const isAia = String(exp.budgetCode || "").startsWith("A.I.a");
    return isAia ? proposed : (expense > 0 ? expense : proposed);
  }

  function renderBudgetOverview({ budgetCode, category, expenses }) {
    el.budgetOverviewTbody.innerHTML = "";

    for (const province of provinces) {
      const matched = expenses.filter(
        (e) => e.objectOfExpenditure === category && e.budgetCode === budgetCode && e.province === province
      );

      const allocated = matched.reduce((sum, e) => sum + (Number(e.proposedAmount) || 0), 0);
      const spent = matched.reduce((sum, e) => sum + computeSpent(e), 0);
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
      tr.innerHTML = `
        <td>${province}</td>
        <td class="num">${money(allocated)}</td>
        <td class="num">${money(spent)}</td>
        <td class="num">${money(remaining)}</td>
        <td class="${statusClass}">${status}</td>
      `;
      el.budgetOverviewTbody.appendChild(tr);
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
    renderBudgetOverview({ budgetCode, category, expenses });

    el.btnBack.addEventListener("click", () => {
      window.location.replace(getAppPath());
    });
  }

  init();
