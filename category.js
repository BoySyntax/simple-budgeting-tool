import { createClient } from "@supabase/supabase-js";

  const provinces = [
    "Regional Office",
    "Bukidnon",
    "Camiguin",
    "Lanao del Norte",
    "Misamis Occidental",
    "Misamis Oriental",
  ];

  const objectOfExpenditures = [
    "Travelling Expenses",
    "Travelling Expense - Foreign", 
    "Training Expenses",
    "Office Supplies Expenses",
    "Gasoline, Oil and Lubricants Expense",
    "Survey Expense",
    "Other Supplies Expenses",
    "Water Consumption",
    "Electric Consumption",
    "Postage and Deliveries",
    "Telephone Expenses - Mobile",
    "Telephone Expenses - Landline",
    "Internet Expenses",
    "Extraordinary and Miscellaneous Expenses",
    "Auditing Expenses",
    "Janitorial Services",
    "Security Services",
    "Other General Services",
    "RM - Office Equipment",
    "RM - ICT Equipment",
    "RM - Transportation Equip - Motor Vehicle",
    "RM - Other Transportation Equipment",
    "RM - Furnitures and Fixtures",
    "RM - Leased Assets Improvements",
    "Fidelity Bond Premium",
    "Insurance Expense - Vehicle/OE",
    "Advertising Expenses",
    "Printing and Publication Expenses",
    "Representation Expenses",
    "Transportation and Delivery Expenses",
    "Rents -Building and Structures",
    "Rents -Motor Vehicles",
    "Rents -Equipments",
    "Rents -Living Quarters",
    "Operating Lease",
    "Financial Lease",
    "Subscription Expenses",
    "Other Maintenance and Operating Expenses",
  ];

  const budgetCodes = [
    "A.I.a - General Administration and Support",
    "A.III.c.1- Processing and Archiving of Civil Registry Documents", 
    "A.III.c.2- Issuance of Civil Registration Certifications / Authentications of Documents"
  ];

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

  const el = {
    categoryTitle: document.getElementById("categoryTitle"),
    categoryOverviewTbody: document.getElementById("categoryOverviewTbody"),
    categoryExpensesTbody: document.getElementById("categoryExpensesTbody"),
    btnBack: document.getElementById("btnBack"),
  };

  function money(n) {
    const num = Number(n) || 0;
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getCategoryFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("category");
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

  function renderCategoryOverview(category, budgetInputs, expenses) {
    el.categoryOverviewTbody.innerHTML = "";

    const categoryBudgets = budgetInputs.filter((b) => b.objectOfExpenditure === category);
    const keys = new Map();

    for (const b of categoryBudgets) {
      const k = `${b.province}|${b.budgetCode}`;
      keys.set(k, { province: b.province, budgetCode: b.budgetCode });
    }
    for (const e of expenses.filter((x) => x.objectOfExpenditure === category)) {
      const k = `${e.province}|${e.budgetCode}`;
      keys.set(k, { province: e.province, budgetCode: e.budgetCode });
    }

    const rows = Array.from(keys.values()).sort((a, b) => {
      const p = String(a.province).localeCompare(String(b.province));
      if (p !== 0) return p;
      return String(a.budgetCode).localeCompare(String(b.budgetCode));
    });

    for (const r of rows) {
      const allocated = categoryBudgets
        .filter((b) => b.province === r.province && b.budgetCode === r.budgetCode)
        .reduce((sum, b) => sum + (Number(b.proposedAmount) || 0), 0);

      const spent = expenses
        .filter((e) => e.objectOfExpenditure === category && e.province === r.province && e.budgetCode === r.budgetCode)
        .reduce((sum, e) => sum + (Number(e.expenseAmount) || 0), 0);

      const remaining = allocated - spent;
      
      let status = "Within Budget";
      let statusClass = "status-good";
      
      if (remaining < 0) {
        status = "Over Budget";
        statusClass = "status-danger";
      } else if (remaining === 0) {
        status = "Budget Met";
        statusClass = "status-warning";
      }
      
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.province}</td>
        <td>${r.budgetCode}</td>
        <td class="num">${money(allocated)}</td>
        <td class="num">${money(spent)}</td>
        <td class="num">${money(remaining)}</td>
        <td class="num ${statusClass}">${status}</td>
      `;
      el.categoryOverviewTbody.appendChild(tr);
    }
  }

  function renderCategoryExpenses(category, expenses) {
    el.categoryExpensesTbody.innerHTML = "";
    
    // Filter expenses for this category
    const categoryExpenses = expenses.filter(exp => exp.objectOfExpenditure === category);
    
    categoryExpenses.forEach((exp, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${exp.province}</td>
        <td>${exp.budgetCode}</td>
        <td class="num">${money(exp.expenseAmount || 0)}</td>
      `;
      el.categoryExpensesTbody.appendChild(tr);
    });
  }

  async function init() {
    const category = getCategoryFromURL();
    if (!category) {
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

    el.categoryTitle.textContent = `${category} - Category Details`;

    const [expenses, budgetInputs] = await Promise.all([loadExpensesFromDb(), loadBudgetInputsFromDb()]);
    renderCategoryOverview(category, budgetInputs, expenses);
    renderCategoryExpenses(category, expenses);

    el.btnBack.addEventListener("click", () => {
      window.location.replace(getAppPath());
    });
  }

  init();
