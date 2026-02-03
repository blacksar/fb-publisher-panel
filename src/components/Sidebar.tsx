"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, FileText, MessageSquare, Settings, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const menuItems = [
  { path: "/dashboard/sessions", label: "Cuentas Sociales", icon: Calendar },
  { path: "/dashboard/pages", label: "Páginas", icon: FileText },
  { path: "/dashboard/posts", label: "Publicaciones", icon: MessageSquare },
  { path: "/dashboard/settings", label: "Ajustes", icon: Settings },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={`bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col ${collapsed ? "w-20" : "w-60"}`}
    >
      {/* Logo */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className={`flex items-center space-x-2 ${collapsed ? "opacity-0" : "opacity-100"}`}>
            <div className="w-8 h-8 bg-[#2563eb] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            {!collapsed && <span className="font-semibold text-gray-900 dark:text-white">Dashboard</span>}
          </div>

          <button
            onClick={onToggle}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.path

            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg relative",
                    isActive
                      ? "bg-[#2563eb] text-white"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span
                    className={`overflow-hidden whitespace-nowrap ${collapsed ? "opacity-0 w-0" : "opacity-100 w-auto"}`}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
