// Cálculos financieros compartidos entre vistas de Afluva.

export function computeBusinessMetrics(transactions = []) {
  const biz = transactions.filter((t) => t.scope === 'business');
  const income = biz.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);

  const ownerRow=t=>t.is_owner_withdrawal===true||t.expense_kind==='owner_withdrawal'||t.financial_class==='owner_withdrawal';
  const outflows=biz.filter(t=>t.type==='expense');
  const company=outflows.filter(t=>!ownerRow(t));
  const costRow=t=>t.financial_class==='cost'||t.expense_kind==='cost_of_sales';
  const sum=rows=>rows.reduce((n,t)=>n+Math.abs(Number(t.amount||0)),0);
  const ownerWithdrawals=sum(outflows.filter(ownerRow));
  const sold=biz.filter(t=>t.type==='income');
  const historical=sold.some(t=>t.cost_of_sales!=null||t.unit_cost!=null);
  const recordedCosts=sold.reduce((n,t)=>{const quantity=Math.max(1,Number(t.quantity)||1);return n+(t.cost_of_sales!=null?Number(t.cost_of_sales)||0:(Number(t.unit_cost)||0)*quantity);},0);
  const losses=sum(company.filter(t=>costRow(t)&&(/p[eé]rdida|merma|desperdicio/i.test(t.category||'')||/merma|desperdicio/i.test(t.description||''))));
  const purchases=Math.max(0,sum(company.filter(costRow))-losses);
  const costOfSales=historical?recordedCosts:purchases>0?purchases:recordedCosts;
  const operatingExpenses=historical||purchases>0?sum(company.filter(t=>!costRow(t)))+losses:sum(company);

  const grossProfit = income - costOfSales;
  const netProfit = grossProfit - operatingExpenses;
  const afterWithdrawals = netProfit - ownerWithdrawals;
  const totalOutflows = costOfSales + operatingExpenses + ownerWithdrawals;
  const expenses = operatingExpenses + costOfSales;
  const netMargin = income > 0 ? (netProfit / income) * 100 : 0;
  const grossMargin = income > 0 ? (grossProfit / income) * 100 : 0;

  const payroll = biz
    .filter((t) => t.type === 'expense' && !t.is_owner_withdrawal && t.expense_kind !== 'owner_withdrawal' && t.financial_class !== 'owner_withdrawal' && /n[oó]mina|sueldo|salario/i.test(t.category || ''))
    .reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
  const salesCoverage = payroll > 0 ? income / payroll : 0;

  const fixedCosts = biz
    .filter((t) => t.type === 'expense'
      && !t.is_owner_withdrawal
      && t.expense_kind !== 'owner_withdrawal' && t.financial_class !== 'owner_withdrawal'
      && t.expense_kind !== 'cost_of_sales'
      && t.cost_behavior === 'fixed')
    .reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);

  const grossMarginRate = income > 0 ? grossMargin / 100 : 0;
  const unknownBehavior = biz.some(t => t.type === 'expense' && !t.is_owner_withdrawal && t.expense_kind !== 'owner_withdrawal' && t.financial_class !== 'owner_withdrawal' && (!t.cost_behavior || t.cost_behavior === 'unknown'));
  const breakEven = grossMarginRate > 0 && !unknownBehavior ? fixedCosts / grossMarginRate : null;

  return {
    income,
    costOfSales,
    grossProfit,
    operatingExpenses,
    ownerWithdrawals,
    expenses,
    totalOutflows,
    netProfit,
    afterWithdrawals,
    netMargin,
    grossMargin,
    cashFlow: income - totalOutflows,
    payroll,
    salesCoverage,
    breakEven,
    fixedCosts
  };
}

export function computePersonalMetrics(transactions = []) {
  const personal = transactions.filter((t) => t.scope === 'personal');
  const income = personal.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
  const expenses = personal.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
  const balance = income - expenses;
  const savingsRate = income > 0 ? (balance / income) * 100 : 0;
  return { income, expenses, balance, savingsRate };
}

export function budgetHealth(spent, limit) {
  if (!limit || limit <= 0) return 'neutral';
  const ratio = spent / limit;
  if (ratio < 0.8) return 'healthy';
  if (ratio <= 1) return 'warning';
  return 'danger';
}

export function formatCurrency(value, currency = 'USD') {
  const num = Number(value || 0);
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency, maximumFractionDigits: 0 }).format(num);
}

export function groupByCategory(transactions = []) {
  const map = {};
  transactions.forEach((t) => {
    const key = t.category || 'General';
    map[key] = (map[key] || 0) + Number(t.amount || 0);
  });
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

// Score de salud financiera 0-100 (semáforo).
export function computeHealthScore(metrics, mode) {
  let score = 0;
  if (mode === 'business') {
    const m = metrics;
    if (m.netProfit > 0) score += 28; else score += Math.max(0, 12 + (m.netProfit / Math.max(1, m.income)) * 100);
    if (m.netMargin >= 20) score += 26;
    else if (m.netMargin >= 10) score += 16;
    else if (m.netMargin >= 0) score += 6;
    if (m.cashFlow > 0) score += 18;
    if (m.salesCoverage >= 2) score += 16;
    else if (m.salesCoverage >= 1.2) score += 10;
    else if (m.salesCoverage > 0) score += 4;
    if (m.income > m.breakEven && m.breakEven > 0) score += 12;
  } else {
    const m = metrics;
    if (m.balance > 0) score += 34; else score += Math.max(0, 10 + (m.balance / Math.max(1, m.income)) * 100);
    if (m.savingsRate >= 20) score += 30;
    else if (m.savingsRate >= 10) score += 18;
    else if (m.savingsRate >= 0) score += 6;
    if (m.income > 0) score += 16;
    if (m.expenses < m.income) score += 20;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function healthLevel(score) {
  if (score >= 70) return { key: 'healthy', label: 'Saludable', color: '#10b981' };
  if (score >= 45) return { key: 'warning', label: 'Atención', color: '#f59e0b' };
  return { key: 'danger', label: 'Crítico', color: '#ef4444' };
}

// Proyección de flujo de caja a 3 meses basada en el promedio mensual actual.
export function projectCashFlow(monthlyData, currentCashFlow) {
  if (!monthlyData.length) return [];
  const last = monthlyData[monthlyData.length - 1];
  const avg = monthlyData.reduce((s, m) => s + (Number(m.Ingresos || 0) - Number(m.Gastos || 0)), 0) / monthlyData.length;
  const proj = [];
  let running = currentCashFlow;
  const months = ['Próx', '+2m', '+3m'];
  months.forEach((label, i) => {
    running += avg;
    proj.push({ name: label, Proyectado: Math.round(running) });
  });
  return proj;
}

