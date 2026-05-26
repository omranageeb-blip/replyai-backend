export type PlanName = "free" | "starter" | "pro" | "business";

export const PLANS: Record<PlanName, {
  messageLimit: number;
  price: number;
  label: string;
  description: string;
  available: boolean;
}> = {
  free: {
    messageLimit: 500,
    price: 0,
    label: "Free",
    description: "للشركات الخمس الأولى فقط — تجريبي",
    available: true,
  },
  starter: {
    messageLimit: 5000,
    price: 19,
    label: "Starter",
    description: "للشركات الصغيرة",
    available: true,
  },
  pro: {
    messageLimit: 20000,
    price: 49,
    label: "Pro",
    description: "للشركات المتوسطة",
    available: false,
  },
  business: {
    messageLimit: 100000,
    price: 149,
    label: "Business",
    description: "للشركات الكبيرة",
    available: false,
  },
};

export const FREE_PLAN_LIMIT = 5;

export function getPlanLimit(plan: string): number {
  return PLANS[plan as PlanName]?.messageLimit ?? 500;
}

export function getPlanPrice(plan: string): number {
  return PLANS[plan as PlanName]?.price ?? 0;
}

export function isValidPlan(plan: string): boolean {
  return plan in PLANS;
}

export function isPlanAvailable(plan: string): boolean {
  return PLANS[plan as PlanName]?.available ?? false;
}