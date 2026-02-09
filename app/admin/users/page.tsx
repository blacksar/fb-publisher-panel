"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useCurrentUser } from "@/contexts/AuthContext"
import { showToast } from "@/lib/toast-config"
import { UserPlus, Loader2, UserCog, Eye } from "lucide-react"

interface UserRow {
  id: string
  email: string
  name: string | null
  role: string
  active: boolean
  createdAt: string
}

export default function AdminUsersPage() {
  const { user: currentUser } = useCurrentUser()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [createEmail, setCreateEmail] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [createName, setCreateName] = useState("")
  const [createRole, setCreateRole] = useState<"ADMIN" | "USER">("USER")
  const [creating, setCreating] = useState(false)

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/auth/list-users", { credentials: "include" })
      const data = await res.json()
      if (res.ok && data.users) setUsers(data.users)
    } catch {
      showToast.error("Error al cargar usuarios")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createEmail.trim() || !createPassword) {
      showToast.error("Email y contraseña requeridos")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/auth/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: createEmail.trim(),
          password: createPassword,
          name: createName.trim() || undefined,
          role: createRole,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast.error(data.error || "Error al crear usuario")
        setCreating(false)
        return
      }
      showToast.success("Usuario creado")
      setCreateOpen(false)
      setCreateEmail("")
      setCreatePassword("")
      setCreateName("")
      setCreateRole("USER")
      fetchUsers()
    } catch {
      showToast.error("Error de conexión")
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (userId: string, active: boolean) => {
    if (userId === currentUser?.id) {
      showToast.error("No puedes desactivar tu propio usuario")
      return
    }
    try {
      const res = await fetch("/api/auth/update-user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId, active }),
      })
      if (!res.ok) {
        const data = await res.json()
        showToast.error(data.error || "Error al actualizar")
        return
      }
      showToast.success(active ? "Usuario activado" : "Usuario desactivado")
      fetchUsers()
    } catch {
      showToast.error("Error de conexión")
    }
  }

  const handleImpersonate = async (userId: string) => {
    try {
      const res = await fetch("/api/auth/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        showToast.error("Error al cambiar de usuario")
        return
      }
      showToast.success("Viendo como usuario. Usa el menú para salir.")
      window.location.href = "/dashboard/sessions"
    } catch {
      showToast.error("Error de conexión")
    }
  }

  if (currentUser?.role !== "ADMIN") {
    return (
      <div className="p-6">
        <p className="text-gray-500 dark:text-gray-400">No tienes permiso para ver esta página.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-gray-900 dark:text-white">Usuarios del panel</CardTitle>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-[#2563eb] hover:bg-[#1d4ed8]"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Crear usuario
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 dark:border-gray-800">
                  <TableHead className="text-gray-900 dark:text-white">Email</TableHead>
                  <TableHead className="text-gray-900 dark:text-white">Nombre</TableHead>
                  <TableHead className="text-gray-900 dark:text-white">Rol</TableHead>
                  <TableHead className="text-gray-900 dark:text-white">Estado</TableHead>
                  <TableHead className="text-gray-900 dark:text-white">Creado</TableHead>
                  <TableHead className="text-gray-900 dark:text-white text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="border-gray-200 dark:border-gray-800">
                    <TableCell className="text-gray-900 dark:text-gray-100">{u.email}</TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-400">{u.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.active ? "default" : "destructive"}>
                        {u.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600 dark:text-gray-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {u.active && u.id !== currentUser?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleImpersonate(u.id)}
                          className="border-gray-200 dark:border-gray-700"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver como
                        </Button>
                      )}
                      {u.id !== currentUser?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(u.id, !u.active)}
                          className="border-gray-200 dark:border-gray-700"
                        >
                          <UserCog className="w-4 h-4 mr-1" />
                          {u.active ? "Desactivar" : "Activar"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Crear usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label className="text-gray-900 dark:text-white">Email</Label>
              <Input
                type="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="usuario@example.com"
                className="mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                required
              />
            </div>
            <div>
              <Label className="text-gray-900 dark:text-white">Contraseña</Label>
              <Input
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                minLength={8}
                required
              />
            </div>
            <div>
              <Label className="text-gray-900 dark:text-white">Nombre (opcional)</Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Nombre"
                className="mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              />
            </div>
            <div>
              <Label className="text-gray-900 dark:text-white">Rol</Label>
              <select
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as "ADMIN" | "USER")}
                className="mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-white"
              >
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creating} className="bg-[#2563eb] hover:bg-[#1d4ed8]">
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
