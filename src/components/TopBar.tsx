"use client"

import { Menu, User, LogOut, Sun, Moon, UserX } from "lucide-react"
import { useTheme } from "next-themes"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/contexts/AuthContext"

interface TopBarProps {
  title: string
  onToggleSidebar: () => void
}

export function TopBar({ title, onToggleSidebar }: TopBarProps) {
  const { user, impersonationUserId, logout } = useCurrentUser()
  const { setTheme, theme } = useTheme()

  const handleLogout = () => {
    logout()
  }

  const handleExitImpersonation = async () => {
    await fetch("/api/auth/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    })
    window.location.reload()
  }

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors md:hidden"
        >
          <Menu className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>

        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h1>
      </div>

      <div className="flex items-center space-x-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="border-gray-200 dark:border-gray-700"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <Avatar className="w-8 h-8">
                <AvatarImage src="/placeholder.svg" alt={user?.name ?? undefined} />
                <AvatarFallback className="bg-[#2563eb] text-white">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                {user?.name || user?.email || "Usuario"}
                {impersonationUserId && " (como usuario)"}
              </span>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem>
              <User className="w-4 h-4 mr-2" />
              {user?.email}
            </DropdownMenuItem>
            {impersonationUserId && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExitImpersonation}>
                  <UserX className="w-4 h-4 mr-2" />
                  Salir de &quot;ver como usuario&quot;
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
