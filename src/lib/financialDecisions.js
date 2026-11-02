const value = input => input !== '' && input != null && Number.isFinite(Number(input)) && Number(input) >= 0 && Number(input) <= 1e12 ? Number(input) : null;
const round = n => Math.round(n * 100) / 100;

export function breakEvenScenario({ fixed, price, variable, quantity }) {
  const values = [fixed, price, variable, quantity].map(value);
  if (values.includes(null)) return { error: 'Completa valores válidos para el mismo período, sin negativos.' };
  const [f, p, v, q] = values;
  const contribution = round(p - v);
  if (contribution <= 0) return { error: 'Con este precio no cubres el costo variable por unidad. Revisa precio y costos antes de aumentar las ventas.' };
  const rawUnits = f / contribution;
  if (![rawUnits, p*q, v*q].every(Number.isFinite)) return { error: 'Los valores son demasiado grandes para esta simulación.' };
  return { contribution, units: Math.ceil(rawUnits), sales: round(Math.ceil(rawUnits)*p), result: round(q*contribution-f) };
}


export function businessRevenueTarget({ fixed, sales, variable, target = 0, days = 30 }) {
 const input=[fixed,sales,variable,target,days].map(value);
 if(input.includes(null)||input[4]<=0||!Number.isInteger(input[4]))return {error:'Completa montos válidos y días del mismo período.'};
 const [f,s,v,t,d]=input;
 if(s<=0)return {error:'Necesitas ventas y costos variables comparables para estimar el margen.'};
 const margin=(s-v)/s;
 if(margin<=0)return {error:'Las ventas no cubren los costos variables. Aumentar volumen con ese margen no cubre los gastos fijos.'};
 const minimum=f/margin, goal=(f+t)/margin;
 if(![minimum,goal].every(Number.isFinite))return {error:'Los valores son demasiado grandes.'};
 return {margin,minimum:Math.ceil(minimum*100)/100,goal:Math.ceil(goal*100)/100,daily:Math.ceil(minimum/d*100)/100,goalDaily:Math.ceil(goal/d*100)/100,result:round(s-v-f)};
}

export function cashAvailableScenario({ cash, confirmedIncome, upcomingPayments, reserve }) {
  const values = [cash, confirmedIncome, upcomingPayments, reserve].map(value);
  if (values.includes(null)) return { error: 'Completa los cuatro valores; escribe cero cuando no aplique.' };
  const [c, i, p, r] = values;
  const afterPayments = round(c+i-p);
  return { afterPayments, available: round(afterPayments-r), shortfall: round(Math.max(0,p+r-c-i)) };
}

export function realizedReduction({ baseline, actual, baselineActivity, actualActivity, comparable = false }) {
  const b=value(baseline), a=value(actual);
  if (b===null||a===null) return { error: 'Completa los gastos registrados para dos períodos de igual duración.' };
  if (!comparable) return { error: 'Confirma que comparaste períodos y servicios equivalentes.' };
  const oldActivity=value(baselineActivity), nextActivity=value(actualActivity);
  if (baselineActivity !== undefined || actualActivity !== undefined) {
    if (oldActivity===null||nextActivity===null||oldActivity<=0||nextActivity<=0) return { error: 'Indica la producción o unidades atendidas en ambos períodos, mayor que cero.' };
    const oldUnit=b/oldActivity, nextUnit=a/nextActivity;
    return { change:round(b-a), unitBefore:oldUnit, unitAfter:nextUnit, efficiencySaving:round((oldUnit-nextUnit)*nextActivity), normalized:true };
  }
  return { change:round(b-a), efficiencySaving:round(b-a), normalized:false };
}
