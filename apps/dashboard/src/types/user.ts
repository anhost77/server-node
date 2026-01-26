export interface User {
  id: string
  email: string
  name?: string
  role: 'user' | 'admin'
  onboardingCompleted: number
  stripeCustomerId?: string
  createdAt?: number
  avatarUrl?: string
  // Billing fields
  billingName?: string
  billingEmail?: string
  billingCompany?: string
  billingAddress?: string
  billingCity?: string
  billingPostalCode?: string
  billingCountry?: string
  billingPhone?: string
  billingVatNumber?: string
}

export interface AuthForm {
  email: string
  password: string
  name: string
}

export type AuthMode = 'login' | 'register' | 'forgot'

export interface OnboardingForm {
  billingName: string
  billingEmail: string
  billingCompany: string
  billingAddress: string
  billingCity: string
  billingPostalCode: string
  billingCountry: string
  billingPhone: string
  billingVatNumber: string
  acceptTerms: boolean
  acceptPrivacy: boolean
  waiveWithdrawal: boolean
}

export interface GithubUser {
  login: string
  avatar_url?: string
  name?: string
}

export interface GithubRepo {
  id: number
  name: string
  full_name: string
  html_url: string
  clone_url: string
  private: boolean
  description?: string
}
