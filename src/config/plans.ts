export const PLANS = {
  free: { messageLimit: 200, companyLimit: 1, price: 0 },
  starter: { messageLimit: 1000, companyLimit: 2, price: 19 },
};

export function getPlanLimit(plan: string) {
  return PLANS[plan as keyof typeof PLANS]?.messageLimit || 200;
}

export function getPlanCompanyLimit(plan: string) {
  return PLANS[plan as keyof typeof PLANS]?.companyLimit || 1;
}

export function isValidPlan(plan: string) {
  return plan in PLANS;
}

export function isPlanAvailable(plan: string) {
  return plan in PLANS;
}