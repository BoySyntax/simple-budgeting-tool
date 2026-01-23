(() => {
  const STORAGE_KEY = "simpleBudgetingTool:v1";

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

  const budgetMaster = [
    // Camiguin - A.I.a (General Administration and Support)
    { province: "Camiguin", budgetCode: "A.I.a - General Administration and Support", objectOfExpenditure: "Travelling Expenses", allocatedAmount: 15000 },
    { province: "Camiguin", budgetCode: "A.I.a - General Administration and Support", objectOfExpenditure: "Training Expenses", allocatedAmount: 20000 },
    { province: "Camiguin", budgetCode: "A.I.a - General Administration and Support", objectOfExpenditure: "Office Supplies Expenses", allocatedAmount: 12000 },
    { province: "Camiguin", budgetCode: "A.I.a - General Administration and Support", objectOfExpenditure: "Gasoline, Oil and Lubricants Expense", allocatedAmount: 10000 },
    
    // Camiguin - A.III.c.1 (Processing and Archiving)
    { province: "Camiguin", budgetCode: "A.III.c.1- Processing and Archiving of Civil Registry Documents", objectOfExpenditure: "Travelling Expenses", allocatedAmount: 8000 },
    { province: "Camiguin", budgetCode: "A.III.c.1- Processing and Archiving of Civil Registry Documents", objectOfExpenditure: "Training Expenses", allocatedAmount: 15000 },
    { province: "Camiguin", budgetCode: "A.III.c.1- Processing and Archiving of Civil Registry Documents", objectOfExpenditure: "Office Supplies Expenses", allocatedAmount: 18000 },
    { province: "Camiguin", budgetCode: "A.III.c.1- Processing and Archiving of Civil Registry Documents", objectOfExpenditure: "Gasoline, Oil and Lubricants Expense", allocatedAmount: 15000 },
    
    // Camiguin - A.III.c.2 (Issuance of Certifications)
    { province: "Camiguin", budgetCode: "A.III.c.2- Issuance of Civil Registration Certifications / Authentications of Documents", objectOfExpenditure: "Travelling Expenses", allocatedAmount: 5000 },
    { province: "Camiguin", budgetCode: "A.III.c.2- Issuance of Civil Registration Certifications / Authentications of Documents", objectOfExpenditure: "Training Expenses", allocatedAmount: 10000 },
    { province: "Camiguin", budgetCode: "A.III.c.2- Issuance of Civil Registration Certifications / Authentications of Documents", objectOfExpenditure: "Office Supplies Expenses", allocatedAmount: 8000 },
    { province: "Camiguin", budgetCode: "A.III.c.2- Issuance of Civil Registration Certifications / Authentications of Documents", objectOfExpenditure: "Gasoline, Oil and Lubricants Expense", allocatedAmount: 6000 },
  ];

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

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { expenses: [] };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.expenses)) return { expenses: [] };
      return { expenses: parsed.expenses };
    } catch {
      return { expenses: [] };
    }
  }

  function getCategoryFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('category');
  }

  function renderCategoryOverview(category, allocatedByDetail, spentByDetail) {
    el.categoryOverviewTbody.innerHTML = "";
    
    // Get all budget master items for this category
    const categoryBudgets = budgetMaster.filter(bm => bm.objectOfExpenditure === category);
    
    for (const bm of categoryBudgets) {
      const key = `${bm.objectOfExpenditure}|${bm.province}|${bm.budgetCode}`;
      const allocated = allocatedByDetail.get(key) || 0;
      const spent = spentByDetail.get(key) || 0;
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
        <td>${bm.province}</td>
        <td>${bm.budgetCode}</td>
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
        <td class="num">${money(exp.proposedAmount || 0)}</td>
        <td class="num">${money(exp.expenseAmount || 0)}</td>
      `;
      el.categoryExpensesTbody.appendChild(tr);
    });
  }

  function calculate() {
    const allocatedByDetail = new Map();
    const spentByDetail = new Map();

    // Calculate allocations by detail
    for (const bm of budgetMaster) {
      const key = `${bm.objectOfExpenditure}|${bm.province}|${bm.budgetCode}`;
      allocatedByDetail.set(key, Number(bm.allocatedAmount) || 0);
    }

    // Calculate spent amounts by detail
    const state = loadState();
    for (const exp of state.expenses) {
      const proposed = Number(exp.proposedAmount) || 0;
      const expense = Number(exp.expenseAmount) || 0;
      const amt = exp.budgetCode === "A.I.a" ? proposed : (expense > 0 ? expense : proposed);

      const key = `${exp.objectOfExpenditure}|${exp.province}|${exp.budgetCode}`;
      spentByDetail.set(key, (spentByDetail.get(key) || 0) + amt);
    }

    return { allocatedByDetail, spentByDetail };
  }

  function init() {
    const category = getCategoryFromURL();
    if (!category) {
      window.location.href = 'index.html';
      return;
    }

    el.categoryTitle.textContent = `${category} - Category Details`;
    
    const { allocatedByDetail, spentByDetail } = calculate();
    const state = loadState();
    
    renderCategoryOverview(category, allocatedByDetail, spentByDetail);
    renderCategoryExpenses(category, state.expenses);

    el.btnBack.addEventListener("click", () => {
      window.location.href = 'index.html';
    });
  }

  init();
})();
