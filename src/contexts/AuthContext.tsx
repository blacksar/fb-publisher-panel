"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"

export type Role = "ADMIN" | "USER"

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: Role
}

interface AuthContextValue {
  user: AuthUser | null
  role: Role | null
  impersonationUserId: string | null
  logout: () => Promise<void>
  loading: boolean
  refetch: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [impersonationUserId, setImpersonationUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" })
      const data = await res.json()
      if (res.ok && data.user) {
        setUser(data.user)
        setImpersonationUserId(data.impersonationUserId ?? null)
      } else {
        setUser(null)
        setImpersonationUserId(null)
      }
    } catch {
      setUser(null)
      setImpersonationUserId(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    setUser(null)
    setImpersonationUserId(null)
    window.location.href = "/login"
  }, [])

  const value: AuthContextValue = {
    user,
    role: user?.role ?? null,
    impersonationUserId,
    logout,
    loading,
    refetch: fetchMe,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useCurrentUser() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useCurrentUser must be used within AuthProvider")
  return ctx
}
