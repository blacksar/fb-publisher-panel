"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"
import { useCurrentUser } from "@/contexts/AuthContext"

interface DashboardLayoutProps {
  children: React.ReactNode
}

const titleMap: Record<string, string> = {
  "/dashboard/sessions": "Cuentas Sociales",
  "/dashboard/pages": "Páginas",
  "/dashboard/posts": "Publicaciones",
  "/dashboard/media": "Medios",
  "/dashboard/settings": "Ajustes",
  "/admin/users": "Usuarios",
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [currentTitle, setCurrentTitle] = useState("Dashboard")
  const pathname = usePathname()
  const router = useRouter()
  const { user, loading } = useCurrentUser()

  useEffect(() => {
    const title = titleMap[pathname] || "Dashboard"
    setCurrentTitle(title)
  }, [pathname])

  useEffect(() => {
    if (!loading && !user) {
      const from = pathname || "/dashboard/sessions"
      router.replace(`/login?from=${encodeURIComponent(from)}`)
    }
  }, [loading, user, pathname, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-gray-500 dark:text-gray-400">Cargando...</div>
      </div>
    )
  }
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-950">
        <div className="text-gray-500 dark:text-gray-400">Redirigiendo al login...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} role={user.role} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={currentTitle} onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />

        <main className="flex-1 overflow-auto p-6 bg-white dark:bg-gray-950">{children}</main>
      </div>
    </div>
  )
}
