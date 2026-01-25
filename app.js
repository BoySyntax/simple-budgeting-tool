import { createClient } from "@supabase/supabase-js";

  const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "https://kjqllxvfdmndawoettoi.supabase.co";
  const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "sb_publishable_L6a3FA_sxA0pRYouRPHN6A_zZ_26T0o";

  let currentUser = null;

  function isAbortError(err) {
    const name = err?.name;
    const message = String(err?.message || "");
    return name === "AbortError" || message.includes("signal is aborted") || message.includes("aborted");
  }

  async function upsertBudgetInputToDb(row) {
    if (!supabase) {
      setError("Supabase is not configured.");
      return false;
    }

    if (!currentUser) {
      setError("Not signed in.");
      return false;
    }

    const payload = {
      object_of_expenditure: row.objectOfExpenditure || "",
      province: row.province || "",
      budget_code: row.budgetCode || "",
      proposed_amount: Number(row.proposedAmount) || 0,
    };

    try {
      const timeoutMs = 30000;
      const timeoutMsg =
        "Save timed out. Open DevTools > Network and check if the /rest/v1/budget_inputs request is failing or blocked.";

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const { data, error } = await withAbortableTimeout(
            (signal) =>
              supabase
                .from("budget_inputs")
                .upsert(payload, { onConflict: "object_of_expenditure,province,budget_code", signal })
                .select("id")
                .single(),
            timeoutMs,
            timeoutMsg
          );

          if (error) {
            setError(error.message);
            return false;
          }
          if (data?.id) row.id = data.id;
          return true;
        } catch (err) {
          const msg = String(err?.message || err);
          const isTimeout = err?.name === "TimeoutError" || /timed out/i.test(msg);
          const isNetworkLike =
            isTimeout ||
            /Failed to fetch/i.test(msg) ||
            /NetworkError/i.test(msg) ||
            /Load failed/i.test(msg) ||
            /ERR_/i.test(msg);

          console.error("Save failed", { attempt, err });
          if (attempt < 2 && isNetworkLike) {
            await sleep(500);
            continue;
          }
          setError(msg);
          return false;
        }
      }
      return false;
    } catch (err) {
      if (isAbortError(err)) return false;
      setError(String(err?.message || err));
      return false;
    }
  }

  async function deleteBudgetInputFromDb(row) {
    if (!supabase) {
      setError("Supabase is not configured.");
      return false;
    }

    if (!currentUser) {
      setError("Not signed in.");
      return false;
    }

    try {
      let query = supabase.from("budget_inputs").delete();
      if (row?.objectOfExpenditure && row?.province && row?.budgetCode) {
        query = query
          .eq("object_of_expenditure", row.objectOfExpenditure)
          .eq("province", row.province)
          .eq("budget_code", row.budgetCode);
      } else {
        query = query.eq("id", row?.id);
      }

      const { error } = await query;
      if (error) {
        setError(error.message);
        return false;
      }
      return true;
    } catch (err) {
      if (isAbortError(err)) return false;
      setError(String(err?.message || err));
      return false;
    }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function createTimeoutError(timeoutMessage) {
    const err = new Error(timeoutMessage || "Request timed out");
    err.name = "TimeoutError";
    return err;
  }

  async function withAbortableTimeout(fn, ms, timeoutMessage) {
    // Prefer AbortSignal.timeout when available (newer Chromium/Firefox), else fall back.
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      try {
        return await fn(AbortSignal.timeout(ms));
      } catch (err) {
        // Some environments throw AbortError on timeout; normalize to TimeoutError for consistent UX.
        if (isAbortError(err)) throw createTimeoutError(timeoutMessage);
        throw err;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fn(controller.signal);
    } catch (err) {
      if (isAbortError(err)) throw createTimeoutError(timeoutMessage);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadBudgetMasterFromDb() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("budget_master")
        .select("object_of_expenditure, province, budget_code, allocated_amount")
        .order("created_at", { ascending: true });

      if (error) {
        setError(error.message);
        return;
      }

      budgetMaster = (data || []).map((row) => ({
        objectOfExpenditure: row.object_of_expenditure,
        province: row.province,
        budgetCode: row.budget_code,
        allocatedAmount: Number(row.allocated_amount) || 0,
      }));
    } catch (err) {
      if (isAbortError(err)) return;
      setError(String(err?.message || err));
    }
  }

  window.addEventListener("unhandledrejection", (event) => {
    if (isAbortError(event?.reason)) {
      event.preventDefault();
    }
  });

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

  const expenseTypes = ["Travelling", "Training", "Office Supplies", "Gasoline/Oil"];

  const budgetCodes = [
    "A.I.a - General Administration and Support",
    "A.III.c.1- Processing and Archiving of Civil Registry Documents", 
    "A.III.c.2- Issuance of Civil Registration Certifications / Authentications of Documents",
    "A.lll.a.1 Conduct of Censuses and Surveys on the Agriculture, Fisheries, Industry and Services Sector",
    "A.lll.a.2 Conduct of Household-Based Censuses and Surveys",
    "A.III.b.1 Statistical Planning , Programming, Budgetting, Monitoring and Evaluation",
    "A.III.b.2 Development and Improvement of Statistical Framework and Standards",
    "A.lll.b.3 Coordination of Statistical Activities at the National and local Levels",
    "CPBI",
    "ASPBI",
    "APIS",
    "NMS",
    "PEENRA",
    "FIES",
    "NDHS",
    "CBMS",
    "STEP",
    "OWS-ISLE"
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

  let budgetMaster = [];

  const el = {
    budgetInputTbody: document.getElementById("budgetInputTbody"),
    expenseTbody: document.getElementById("expenseTbody"),
    budgetSummaryTbody: document.getElementById("budgetSummaryTbody"),
    budgetSummarySearch: document.getElementById("budgetSummarySearch"),
    loginEmail: document.getElementById("loginEmail"),
    loginPassword: document.getElementById("loginPassword"),
    btnLogin: document.getElementById("btnLogin"),
    btnGoogle: document.getElementById("btnGoogle"),
    btnLogout: document.getElementById("btnLogout"),
    authStatus: document.getElementById("authStatus"),
    btnAddBudgetRow: document.getElementById("btnAddBudgetRow"),
    btnAddRow: document.getElementById("btnAddRow"),
  };

  const isLoginPage = Boolean(el.btnLogin || el.btnGoogle);

  function money(n) {
    const num = Number(n) || 0;
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getOAuthRedirectTo() {
    if (window.location.protocol === "file:") {
      return null;
    }
    return new URL(getAppPath(), window.location.origin).toString();
  }

  async function loadExpensesFromDb() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, object_of_expenditure, province, budget_code, expense_amount")
        .order("created_at", { ascending: true });

      if (error) {
        setError(error.message);
        return;
      }

      const expenses = (data || []).map((row) =>
        normalizeExpense({
          id: row.id,
          objectOfExpenditure: row.object_of_expenditure,
          province: row.province,
          budgetCode: row.budget_code,
          expenseAmount: row.expense_amount,
        })
      );

      const drafts = (state.expenses || []).filter((r) => r?.isDraft);

      state = {
        ...state,
        expenses: [...expenses, ...(drafts.length ? drafts : [defaultExpenseRow()])],
      };
      render();
    } catch (err) {
      if (isAbortError(err)) return;
      setError(String(err?.message || err));
    }
  }

  async function loadBudgetInputsFromDb() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("budget_inputs")
        .select("id, object_of_expenditure, province, budget_code, proposed_amount")
        .order("created_at", { ascending: true });

      if (error) {
        setError(error.message);
        return;
      }

      const rows = (data || []).map((row) =>
        normalizeBudgetInput({
          id: row.id,
          objectOfExpenditure: row.object_of_expenditure,
          province: row.province,
          budgetCode: row.budget_code,
          proposedAmount: row.proposed_amount,
        })
      );

      const drafts = (state.budgetInputs || []).filter((r) => r?.isDraft);

      state = {
        ...state,
        budgetInputs: [...rows, ...(drafts.length ? drafts : [defaultBudgetInputRow()])],
      };
      render();
    } catch (err) {
      if (isAbortError(err)) return;
      setError(String(err?.message || err));
    }
  }

  async function upsertExpenseToDb(exp) {
    if (!supabase) {
      setError("Supabase is not configured.");
      return false;
    }

    if (!currentUser) {
      setError("Not signed in.");
      return false;
    }

    const payload = {
      id: exp.id,
      object_of_expenditure: exp.objectOfExpenditure || "",
      province: exp.province || "",
      budget_code: exp.budgetCode || "",
      expense_amount: Number(exp.expenseAmount) || 0,
    };

    try {
      // 12s is often too aggressive on cold starts / slow networks. Use a longer, abortable timeout
      // and a small retry for transient network hiccups.
      const timeoutMs = 30000;
      const timeoutMsg =
        "Save timed out. Open DevTools > Network and check if the /rest/v1/expenses request is failing or blocked.";

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const { error } = await withAbortableTimeout(
            (signal) => supabase.from("expenses").upsert(payload, { onConflict: "id", signal }),
            timeoutMs,
            timeoutMsg
          );

          if (error) {
            setError(error.message);
            return false;
          }
          return true;
        } catch (err) {
          const msg = String(err?.message || err);
          const isTimeout = err?.name === "TimeoutError" || /timed out/i.test(msg);
          const isNetworkLike =
            isTimeout ||
            /Failed to fetch/i.test(msg) ||
            /NetworkError/i.test(msg) ||
            /Load failed/i.test(msg) ||
            /ERR_/i.test(msg);

          console.error("Save failed", { attempt, err });
          if (attempt < 2 && isNetworkLike) {
            await sleep(500);
            continue;
          }
          setError(msg);
          return false;
        }
      }
      return false;
    } catch (err) {
      if (isAbortError(err)) return false;
      setError(String(err?.message || err));
      return false;
    }
  }

  async function deleteExpenseFromDb(id) {
    if (!supabase) {
      setError("Supabase is not configured.");
      return false;
    }

    if (!currentUser) {
      setError("Not signed in.");
      return false;
    }

    try {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) {
        setError(error.message);
        return false;
      }
      return true;
    } catch (err) {
      if (isAbortError(err)) return false;
      setError(String(err?.message || err));
      return false;
    }
  }

  function uid() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function defaultExpenseRow() {
    return {
      id: uid(),
      objectOfExpenditure: "",
      province: "",
      budgetCode: "",
      expenseAmount: 0,
      isDraft: true,
    };
  }

  function defaultBudgetInputRow() {
    return {
      id: uid(),
      objectOfExpenditure: "",
      province: "",
      budgetCode: "",
      proposedAmount: 0,
      isDraft: true,
    };
  }

  const supabase = (() => {
    if (window.location.protocol === "file:") return null;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    if (SUPABASE_URL.includes("PASTE_") || SUPABASE_ANON_KEY.includes("PASTE_")) return null;

    // Add a defensive global fetch timeout (covers all requests, not just save),
    // while still allowing per-call AbortSignals (we merge them).
    const DEFAULT_FETCH_TIMEOUT_MS = 45000;
    const fetchWithTimeout = async (url, options = {}) => {
      const originalSignal = options.signal;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);

      const onAbort = () => controller.abort();
      try {
        if (originalSignal) {
          if (originalSignal.aborted) controller.abort();
          else originalSignal.addEventListener("abort", onAbort, { once: true });
        }
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timer);
        if (originalSignal) originalSignal.removeEventListener("abort", onAbort);
      }
    };

    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { fetch: fetchWithTimeout } });
  })();

  function normalizeExpense(e) {
    const legacyAmount = Number.isFinite(Number(e?.amount)) ? Number(e.amount) : null;
    const normalizedExpenseAmount = Number.isFinite(Number(e?.expenseAmount))
      ? Number(e.expenseAmount)
      : (legacyAmount ?? 0);

    return {
      id: typeof e?.id === "string" ? e.id : uid(),
      objectOfExpenditure: objectOfExpenditures.includes(e?.objectOfExpenditure)
        ? e.objectOfExpenditure
        : "",
      province: provinces.includes(e?.province) ? e.province : "",
      budgetCode: budgetCodes.includes(e?.budgetCode) ? e.budgetCode : "",
      expenseAmount: Number.isFinite(Number(normalizedExpenseAmount)) ? Number(normalizedExpenseAmount) : 0,
      isDraft: false,
    };
  }

  function normalizeBudgetInput(e) {
    return {
      id: typeof e?.id === "string" ? e.id : uid(),
      objectOfExpenditure: objectOfExpenditures.includes(e?.objectOfExpenditure)
        ? e.objectOfExpenditure
        : "",
      province: provinces.includes(e?.province) ? e.province : "",
      budgetCode: budgetCodes.includes(e?.budgetCode) ? e.budgetCode : "",
      proposedAmount: Number.isFinite(Number(e?.proposedAmount)) ? Number(e.proposedAmount) : 0,
      isDraft: false,
    };
  }

  let state = {
    expenses: [defaultExpenseRow()],
    budgetInputs: [defaultBudgetInputRow()],
    budgetSummarySearch: "",
  };

  function matchesSmart(text, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    const t = String(text || "").toLowerCase();
    if (t.includes(q)) return true;

    const words = t.split(/[^a-z0-9]+/i).filter(Boolean);
    if (words.length) {
      const initials = words.map((w) => w[0]).join("");
      if (initials.startsWith(q)) return true;
      // Also allow prefix matching by word starts in order
      let qi = 0;
      for (const w of words) {
        if (qi >= q.length) break;
        if (w.startsWith(q[qi])) qi += 1;
      }
      if (qi >= q.length) return true;
    }
    return false;
  }

  function setAuthUI({ signedIn, email }) {
    if (el.btnLogout) el.btnLogout.hidden = !signedIn;
    if (el.authStatus) el.authStatus.textContent = signedIn ? `Signed in: ${email || ""}` : "";
    if (el.btnAddRow) el.btnAddRow.disabled = !signedIn;
  }

  function setError(msg) {
    if (!msg) return;
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const t = document.createElement("div");
    t.className = "toast error";
    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.textContent = "×";
    const m = document.createElement("span");
    m.className = "toast-message";
    m.textContent = String(msg);
    t.appendChild(icon);
    t.appendChild(m);
    container.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  const toast = (() => {
    let container;
    const ensure = () => {
      if (container) return container;
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
      return container;
    };

    const show = (message, type = "success") => {
      const c = ensure();
      const t = document.createElement("div");
      t.className = `toast ${type}`;

      const icon = document.createElement("span");
      icon.className = "toast-icon";
      icon.textContent = type === "success" ? "✓" : "×";

      const msg = document.createElement("span");
      msg.className = "toast-message";
      msg.textContent = message;

      t.appendChild(icon);
      t.appendChild(msg);
      c.appendChild(t);
      setTimeout(() => t.remove(), 2600);
    };

    return { show };
  })();

  function createOption(text) {
    const opt = document.createElement("option");
    opt.value = text;
    opt.textContent = text;
    return opt;
  }

  function createSelect(options, value, onChange, placeholder = "") {
    const select = document.createElement("select");
    
    // Add placeholder as first option if provided
    if (placeholder) {
      const placeholderOption = document.createElement("option");
      placeholderOption.value = "";
      placeholderOption.textContent = placeholder;
      placeholderOption.disabled = true;
      placeholderOption.selected = !value;
      select.appendChild(placeholderOption);
    }
    
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = o;
      opt.textContent = o;
      select.appendChild(opt);
    }
    
    // Set the actual value if it exists
    if (value) {
      select.value = value;
    }
    
    select.addEventListener("change", () => onChange(select.value, select));
    return select;
  }

  function createInput({ type = "text", value = "", onInput, className = "input", step } = {}) {
    const input = document.createElement("input");
    input.type = type;
    input.value = value;
    input.className = className;
    if (step != null) input.step = String(step);
    input.addEventListener("input", () => onInput(input.value, input));
    return input;
  }

  function validateExpense(e) {
    if (!objectOfExpenditures.includes(e.objectOfExpenditure)) return "Object of Expenditures is required.";
    if (!provinces.includes(e.province)) return "Province is required.";
    if (!budgetCodes.includes(e.budgetCode)) return "Budget Code is required.";
    if (!Number.isFinite(Number(e.expenseAmount))) return "Expense Amount must be a number.";
    if (Number(e.expenseAmount) < 0) return "Expense Amount cannot be negative.";
    return null;
  }

  function validateBudgetInputRow(e) {
    if (!objectOfExpenditures.includes(e.objectOfExpenditure)) return "Object of Expenditures is required.";
    if (!provinces.includes(e.province)) return "Province is required.";
    if (!budgetCodes.includes(e.budgetCode)) return "Budget Code is required.";
    if (!Number.isFinite(Number(e.proposedAmount))) return "Proposed Amount must be a number.";
    if (Number(e.proposedAmount) < 0) return "Proposed Amount cannot be negative.";
    return null;
  }

  function renderBudgetInputs() {
    if (!el.budgetInputTbody) return;
    el.budgetInputTbody.innerHTML = "";

    const draftRows = (state.budgetInputs || []).filter((r) => r?.isDraft);

    draftRows.forEach((row, i) => {
      const tr = document.createElement("tr");

      const tdIndex = document.createElement("td");
      tdIndex.textContent = String(i + 1);

      const tdObject = document.createElement("td");
      const objectSelect = createSelect(objectOfExpenditures, row.objectOfExpenditure, (val) => {
        row.objectOfExpenditure = val;
        setError(null);
      }, "Object of Expenditures");
      tdObject.appendChild(objectSelect);

      const tdProvince = document.createElement("td");
      const provinceSelect = createSelect(provinces, row.province, (val) => {
        row.province = val;
        setError(null);
      }, "Province");
      tdProvince.appendChild(provinceSelect);

      const tdBudget = document.createElement("td");
      const budgetSelect = createSelect(budgetCodes, row.budgetCode, (val) => {
        row.budgetCode = val;
        setError(null);
      }, "Budget Code");
      tdBudget.appendChild(budgetSelect);

      const tdProposed = document.createElement("td");
      tdProposed.className = "num";
      const proposedInput = createInput({
        type: "number",
        value: String(row.proposedAmount ?? 0),
        step: 0.01,
        onInput: (val, inputEl) => {
          const num = Number(val);
          row.proposedAmount = Number.isFinite(num) ? num : 0;

          const err = validateBudgetInputRow(row);
          if (err) {
            inputEl.classList.add("invalid");
            setError(err);
          } else {
            inputEl.classList.remove("invalid");
            setError(null);
          }
        },
      });
      proposedInput.classList.toggle("invalid", Number(row.proposedAmount) < 0);
      tdProposed.appendChild(proposedInput);

      const tdAction = document.createElement("td");
      tdAction.style.display = "inline-flex";
      tdAction.style.gap = "8px";
      tdAction.style.alignItems = "center";

      const btnDelete = document.createElement("button");
      btnDelete.type = "button";
      btnDelete.className = "btn danger";
      btnDelete.textContent = "Delete";
      btnDelete.addEventListener("click", async () => {
        if (btnDelete.disabled) return;
        const originalText = btnDelete.textContent;
        btnDelete.disabled = true;
        btnDelete.textContent = "Deleting...";
        btnSave.disabled = true;
        state.budgetInputs = (state.budgetInputs || []).filter((x) => x.id !== row.id);
        const remainingDrafts = (state.budgetInputs || []).filter((x) => x?.isDraft);
        if (remainingDrafts.length === 0) state.budgetInputs.push(defaultBudgetInputRow());
        render();
        toast.show("Deleted successfully", "error");
        btnDelete.disabled = false;
        btnDelete.textContent = originalText;
        btnSave.disabled = false;
      });
      tdAction.appendChild(btnDelete);

      const btnSave = document.createElement("button");
      btnSave.type = "button";
      btnSave.className = "btn primary";
      btnSave.textContent = "Save";
      btnSave.addEventListener("click", async () => {
        if (btnSave.disabled) return;
        const err = validateBudgetInputRow(row);
        if (err) {
          setError(err);
          return;
        }
        const originalText = btnSave.textContent;
        btnSave.disabled = true;
        btnSave.textContent = "Saving...";
        setError(null);

        let finished = false;
        const restore = () => {
          if (finished) return;
          finished = true;
          btnSave.textContent = originalText;
          btnSave.disabled = false;
        };

        const uiTimeoutMs = 32000;
        const safety = setTimeout(() => {
          setError(
            "Save timed out. Open DevTools > Network and check if the /rest/v1/budget_inputs request is failing or blocked."
          );
          restore();
        }, uiTimeoutMs);
        try {
          const ok = await upsertBudgetInputToDb(row);
          if (!ok) return;
          btnSave.textContent = "Saved";
          // Remove the draft row from the input table and refresh saved inputs.
          state.budgetInputs = (state.budgetInputs || []).filter((x) => x.id !== row.id);
          const remainingDrafts = (state.budgetInputs || []).filter((x) => x?.isDraft);
          if (remainingDrafts.length === 0) state.budgetInputs.push(defaultBudgetInputRow());
          await loadBudgetInputsFromDb();
          toast.show("Saved successfully", "success");
          setTimeout(restore, 300);
        } finally {
          clearTimeout(safety);
          if (!finished && btnSave.textContent !== "Saved") restore();
        }
      });
      tdAction.appendChild(btnSave);

      tr.appendChild(tdIndex);
      tr.appendChild(tdObject);
      tr.appendChild(tdProvince);
      tr.appendChild(tdBudget);
      tr.appendChild(tdProposed);
      tr.appendChild(tdAction);

      el.budgetInputTbody.appendChild(tr);
    });
  }

  function renderExpenses() {
    if (!el.expenseTbody) return;
    el.expenseTbody.innerHTML = "";

    const draftRows = (state.expenses || []).filter((r) => r?.isDraft);

    draftRows.forEach((exp, i) => {
      const tr = document.createElement("tr");

      const tdIndex = document.createElement("td");
      tdIndex.textContent = String(i + 1);

      const tdObject = document.createElement("td");
      const objectSelect = createSelect(objectOfExpenditures, exp.objectOfExpenditure, (val) => {
        exp.objectOfExpenditure = val;
        setError(null);
      }, "Object of Expenditures");
      tdObject.appendChild(objectSelect);

      const tdProvince = document.createElement("td");
      const provinceSelect = createSelect(provinces, exp.province, (val) => {
        exp.province = val;
        setError(null);
      }, "Province");
      tdProvince.appendChild(provinceSelect);

      const tdBudget = document.createElement("td");
      let expenseAmountInput;
      const budgetSelect = createSelect(budgetCodes, exp.budgetCode, (val) => {
        exp.budgetCode = val;
        setError(null);
      }, "Budget Code");
      tdBudget.appendChild(budgetSelect);

      const tdExpenseAmount = document.createElement("td");
      tdExpenseAmount.className = "num";
      expenseAmountInput = createInput({
        type: "number",
        value: String(exp.expenseAmount ?? 0),
        step: 0.01,
        onInput: (val, inputEl) => {
          const num = Number(val);
          exp.expenseAmount = Number.isFinite(num) ? num : 0;

          const err = validateExpense(exp);
          if (err) {
            inputEl.classList.add("invalid");
            setError(err);
          } else {
            inputEl.classList.remove("invalid");
            setError(null);
          }
        },
      });
      expenseAmountInput.classList.toggle("invalid", Number(exp.expenseAmount) < 0);
      tdExpenseAmount.appendChild(expenseAmountInput);

      const tdAction = document.createElement("td");
      tdAction.style.display = "inline-flex";
      tdAction.style.gap = "8px";
      tdAction.style.alignItems = "center";

      const btnDelete = document.createElement("button");
      btnDelete.type = "button";
      btnDelete.className = "btn danger";
      btnDelete.textContent = "Delete";
      btnDelete.addEventListener("click", async () => {
        if (btnDelete.disabled) return;
        const originalText = btnDelete.textContent;
        btnDelete.disabled = true;
        btnDelete.textContent = "Deleting...";
        btnSave.disabled = true;
        state.expenses = (state.expenses || []).filter((x) => x.id !== exp.id);
        const remainingDrafts = (state.expenses || []).filter((x) => x?.isDraft);
        if (remainingDrafts.length === 0) state.expenses.push(defaultExpenseRow());
        render();
        toast.show("Deleted successfully", "error");
        btnDelete.disabled = false;
        btnDelete.textContent = originalText;
        btnSave.disabled = false;
      });
      tdAction.appendChild(btnDelete);

      const btnSave = document.createElement("button");
      btnSave.type = "button";
      btnSave.className = "btn primary";
      btnSave.textContent = "Save";
      btnSave.addEventListener("click", async () => {
        if (btnSave.disabled) return;
        const err = validateExpense(exp);
        if (err) {
          setError(err);
          return;
        }
        const originalText = btnSave.textContent;
        btnSave.disabled = true;
        btnSave.textContent = "Saving...";
        setError(null);

        let finished = false;
        const restore = () => {
          if (finished) return;
          finished = true;
          btnSave.textContent = originalText;
          btnSave.disabled = false;
        };

        const uiTimeoutMs = 32000;
        const safety = setTimeout(() => {
          setError("Save timed out. Open DevTools > Network and check if the /rest/v1/expenses request is failing or blocked.");
          restore();
        }, uiTimeoutMs);
        try {
          const ok = await upsertExpenseToDb(exp);
          if (!ok) return;
          btnSave.textContent = "Saved";
          toast.show("Saved successfully", "success");
          // Remove the draft row from the input table and refresh saved expenses.
          state.expenses = (state.expenses || []).filter((x) => x.id !== exp.id);
          const remainingDrafts = (state.expenses || []).filter((x) => x?.isDraft);
          if (remainingDrafts.length === 0) state.expenses.push(defaultExpenseRow());
          await loadExpensesFromDb();
          setTimeout(restore, 300);
        } finally {
          clearTimeout(safety);
          if (!finished && btnSave.textContent !== "Saved") restore();
        }
      });
      tdAction.appendChild(btnSave);

      tr.appendChild(tdIndex);
      tr.appendChild(tdObject);
      tr.appendChild(tdProvince);
      tr.appendChild(tdBudget);
      tr.appendChild(tdExpenseAmount);
      tr.appendChild(tdAction);

      el.expenseTbody.appendChild(tr);
    });
  }

  function calculate() {
    const spentByBudgetCode = new Map();
    const allocatedByBudgetCode = new Map();
    const allocatedByDetail = new Map();
    const spentByDetail = new Map();

    for (const bc of budgetCodes) {
      spentByBudgetCode.set(bc, 0);
      allocatedByBudgetCode.set(bc, 0);
    }

    for (const bi of state.budgetInputs || []) {
      if (bi?.isDraft) continue;
      const key = `${bi.objectOfExpenditure}|${bi.province}|${bi.budgetCode}`;
      allocatedByDetail.set(key, Number(bi.proposedAmount) || 0);
      allocatedByBudgetCode.set(
        bi.budgetCode,
        (allocatedByBudgetCode.get(bi.budgetCode) || 0) + Number(bi.proposedAmount || 0)
      );
    }

    for (const exp of state.expenses) {
      if (exp?.isDraft) continue;
      const expense = Number(exp.expenseAmount) || 0;
      const amt = expense;

      spentByBudgetCode.set(exp.budgetCode, (spentByBudgetCode.get(exp.budgetCode) || 0) + amt);

      const key = `${exp.objectOfExpenditure}|${exp.province}|${exp.budgetCode}`;
      spentByDetail.set(key, (spentByDetail.get(key) || 0) + amt);
    }

    return {
      spentByBudgetCode,
      allocatedByBudgetCode,
      allocatedByDetail,
      spentByDetail,
    };
  }

  function renderBudgetSummary({ allocatedByDetail, spentByDetail }) {
    if (!el.budgetSummaryTbody) return;
    el.budgetSummaryTbody.innerHTML = "";

    const q = String(state?.budgetSummarySearch || "");

    for (const category of objectOfExpenditures) {
      if (!matchesSmart(category, q)) continue;
      const detailRow = document.createElement("tr");
      detailRow.className = "detail-row";
      
      const tdObject = document.createElement("td");
      tdObject.textContent = category;
      
      const tdBudget = document.createElement("td");
      const budgetSelect = document.createElement("select");
      budgetSelect.className = "input";
      
      // Add placeholder option first
      const placeholderOption = document.createElement("option");
      placeholderOption.value = "";
      placeholderOption.textContent = "Budget Code";
      placeholderOption.disabled = true;
      placeholderOption.selected = true;
      budgetSelect.appendChild(placeholderOption);
      
      // Add budget code options
      for (const bc of budgetCodes) {
        const option = document.createElement("option");
        option.value = bc;
        option.textContent = bc;
        budgetSelect.appendChild(option);
      }
      
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.className = "btn";
      openButton.textContent = "Open";
      openButton.style.padding = "4px 8px";
      openButton.style.fontSize = "12px";
      
      openButton.addEventListener("click", () => {
        const selectedBudget = budgetSelect.value;
        if (!selectedBudget) {
          // Show error if no budget code selected
          setError("Please select a budget code first");
          return;
        }
        const categoryParam = encodeURIComponent(category);
        const budgetParam = encodeURIComponent(selectedBudget);
        window.location.href = `budget.html?category=${categoryParam}&budget=${budgetParam}`;
      });
      
      tdBudget.appendChild(budgetSelect);
      tdBudget.appendChild(openButton);
      
      detailRow.appendChild(tdObject);
      detailRow.appendChild(tdBudget);
      
      el.budgetSummaryTbody.appendChild(detailRow);
    }
  }

  function renderSummaries() {
    if (!el.budgetSummaryTbody) return;
    const { allocatedByDetail, spentByDetail } = calculate();
    renderBudgetSummary({ allocatedByDetail, spentByDetail });
  }

  function render() {
    if (!el.expenseTbody && !el.budgetInputTbody && !el.budgetSummaryTbody) return;
    renderBudgetInputs();
    renderExpenses();
    renderSummaries();
  }

  if (el.budgetSummarySearch) {
    el.budgetSummarySearch.addEventListener("input", (e) => {
      state.budgetSummarySearch = String(e?.target?.value || "");
      renderSummaries();
    });
  }

  if (el.btnAddBudgetRow) {
    el.btnAddBudgetRow.addEventListener("click", () => {
      const row = defaultBudgetInputRow();
      state.budgetInputs.push(row);
      void upsertBudgetInputToDb(row);
      render();
    });
  }

  if (el.btnAddRow) {
    el.btnAddRow.addEventListener("click", () => {
      const row = defaultExpenseRow();
      state.expenses.push(row);
      render();
    });
  }

  async function initAuth() {
    if (!supabase) {
      setAuthUI({ signedIn: false, email: "" });
      setError("Supabase is not configured. Paste your SUPABASE_URL and SUPABASE_ANON_KEY in app.js.");
      return;
    }

    let session;
    try {
      const { data } = await supabase.auth.getSession();
      session = data?.session;
    } catch (err) {
      if (isAbortError(err)) return;
      setError(String(err?.message || err));
      return;
    }
    if (session?.user) {
      currentUser = session.user;
      setAuthUI({ signedIn: true, email: session.user.email });
      if (isLoginPage) {
        window.location.replace(getAppPath());
        return;
      }
      await loadBudgetMasterFromDb();
      await loadBudgetInputsFromDb();
      await loadExpensesFromDb();
    } else {
      currentUser = null;
      setAuthUI({ signedIn: false, email: "" });
      if (!isLoginPage) {
        window.location.replace(getLoginPath());
        return;
      }
      state = { expenses: [defaultExpenseRow()], budgetInputs: [defaultBudgetInputRow()] };
      render();
    }

    supabase.auth.onAuthStateChange(async (_event, newSession) => {
      try {
        if (newSession?.user) {
          currentUser = newSession.user;
          setAuthUI({ signedIn: true, email: newSession.user.email });
          if (isLoginPage) {
            window.location.replace(getAppPath());
            return;
          }
          await loadBudgetMasterFromDb();
          await loadBudgetInputsFromDb();
          await loadExpensesFromDb();
        } else {
          currentUser = null;
          setAuthUI({ signedIn: false, email: "" });
          if (!isLoginPage) {
            window.location.replace(getLoginPath());
            return;
          }
          state = { expenses: [defaultExpenseRow()], budgetInputs: [defaultBudgetInputRow()] };
          render();
        }
      } catch (err) {
        if (isAbortError(err)) return;
        setError(String(err?.message || err));
      }
    });
  }

  if (el.btnLogin) {
    el.btnLogin.addEventListener("click", async () => {
      if (!supabase) {
        setError("Supabase is not configured.");
        return;
      }
      const email = (el.loginEmail?.value || "").trim();
      const password = el.loginPassword?.value || "";
      if (!email || !password) {
        setError("Email and password are required.");
        return;
      }
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message);
        else setError(null);
      } catch (err) {
        if (isAbortError(err)) return;
        setError(String(err?.message || err));
      }
    });

    const triggerLoginOnEnter = (event) => {
      if (event?.key !== "Enter") return;
      event.preventDefault();
      el.btnLogin?.click();
    };

    if (el.loginEmail) el.loginEmail.addEventListener("keydown", triggerLoginOnEnter);
    if (el.loginPassword) el.loginPassword.addEventListener("keydown", triggerLoginOnEnter);
  }

  if (el.btnGoogle) {
    el.btnGoogle.addEventListener("click", async () => {
      if (!supabase) {
        setError("Supabase is not configured.");
        return;
      }

      const redirectTo = getOAuthRedirectTo();
      if (!redirectTo) {
        setError("Google login requires running the app from http://localhost (not file://). Start a local web server, then try again.");
        return;
      }

      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        if (error) setError(error.message);
        else setError(null);
      } catch (err) {
        if (isAbortError(err)) return;
        setError(String(err?.message || err));
      }
    });
  }

  if (el.btnLogout) {
    el.btnLogout.addEventListener("click", async () => {
      if (!supabase) return;
      try {
        let error = null;
        try {
          ({ error } = await supabase.auth.signOut({ scope: "global" }));
        } catch (err) {
          error = err;
        }

        const errorMessage = error?.message || "";
        const looksForbidden = /403|forbidden/i.test(errorMessage);
        if (error && looksForbidden) {
          try {
            await supabase.auth.signOut({ scope: "local" });
            error = null;
          } catch (err) {
            // keep original error
          }
        }

        if (error) setError(errorMessage || String(error));
        else setError(null);

        // Always clear UI + state locally so the user can continue.
        currentUser = null;
        setAuthUI({ signedIn: false, email: "" });
        state = { expenses: [defaultExpenseRow()], budgetInputs: [defaultBudgetInputRow()] };
        window.location.replace(getLoginPath());
      } catch (err) {
        if (isAbortError(err)) return;
        setError(String(err?.message || err));
      }
    });
  }

  initAuth();
