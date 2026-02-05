"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { useAuthStore } from "@/lib/authStore"

interface DashboardLayoutProps {
  children: React.ReactNode
}

const titleMap: Record<string, string> = {
  "/dashboard/sessions": "Cuentas Sociales",
  "/dashboard/pages": "Páginas",
  "/dashboard/posts": "Publicaciones",
  "/dashboard/media": "Medios",
  "/dashboard/settings": "Ajustes",
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [currentTitle, setCurrentTitle] = useState("Dashboard")
  const pathname = usePathname()

  // Initialize auth store with mock data for demo
  useEffect(() => {
    const { login, isAuthenticated } = useAuthStore.getState()
    if (!isAuthenticated) {
      login(
        {
          id: 1,
          name: "Usuario Demo",
          email: "demo@example.com",
          avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face",
        },
        "mock-token-123",
      )
    }
  }, [])

  useEffect(() => {
    const title = titleMap[pathname] || "Dashboard"
    setCurrentTitle(title)
  }, [pathname])

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={currentTitle} onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />

        <main className="flex-1 overflow-auto p-6 bg-white dark:bg-gray-950">{children}</main>
      </div>
    </div>
  )
}
