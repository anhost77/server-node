export interface Plan {
  id: string
  name: string
  displayName: string
  description: string
  priceMonthly: number
  priceYearly: number
  maxServers: number
  maxApps: number
  maxDomains: number
  maxDeploysPerDay: number
  stripePriceIdMonthly?: string
  stripePriceIdYearly?: string
  isActive: boolean
  isDefault: boolean
}

export interface Subscription {
  planName: string
  planDisplayName: string
  isPaid: boolean
  isActive: boolean
  isPastDue: boolean
  periodEnd?: number
}

export interface UsageReport {
  usage: {
    servers: UsageItem
    apps: UsageItem
    domains: UsageItem
    deploysToday: UsageItem
  }
}

export interface UsageItem {
  current: number
  limit: number
  percentage: number
}

export interface PlanForm {
  name: string
  displayName: string
  description: string
  priceMonthly: number
  priceYearly: number
  maxServers: number
  maxApps: number
  maxDomains: number
  maxDeploysPerDay: number
  stripePriceIdMonthly: string
  stripePriceIdYearly: string
  isActive: boolean
  isDefault: boolean
}
