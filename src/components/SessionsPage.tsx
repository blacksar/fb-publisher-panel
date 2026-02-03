"use client"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { motion } from "framer-motion"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Row,
  type Column,
} from "@tanstack/react-table"
import { Plus, Eye, Trash2, MoreHorizontal, ArrowUpDown, Edit, CheckCircle, Cookie, LogIn, ArrowLeft, Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getSessions, createSession, updateSession, deleteSession, verifySession } from "@/app/actions"
import axios from "axios"
import { showToast } from "@/lib/toast-config"

interface Session {
  id: number
  name: string
  cookie: string
  status: string
  c_user: string | null
  user_name: string | null
  created_at: Date
  verified_at: Date | null
}

// Status badge colors
const statusColors: Record<string, string> = {
  verified: "text-green-600 dark:text-green-400",
  active: "text-blue-600 dark:text-blue-400",
  inactive: "text-red-600 dark:text-red-400",
  pending: "text-yellow-600 dark:text-yellow-400",
}

const statusLabels: Record<string, string> = {
  verified: "Verificada",
  active: "Activa",
  inactive: "Inactiva",
  pending: "Pendiente",
}

export function SessionsPage() {
  const [mounted, setMounted] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createModalMode, setCreateModalMode] = useState<"choice" | "cookies" | "login">("choice")
  const [loginForm, setLoginForm] = useState({ email: "", password: "", wait2faSeconds: 120 })
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginStatus, setLoginStatus] = useState<"idle" | "awaiting_2fa" | "success">("idle")
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteMultipleDialogOpen, setDeleteMultipleDialogOpen] = useState(false)
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Form states
  const [newSession, setNewSession] = useState({
    name: "",
    cookie: "",
  })

  const fetchSessions = useCallback(async () => {
    try {
      const data = await getSessions()
      setSessions(data)
    } catch (error) {
      showToast.error("Error al cargar las sesiones")
    }
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      void fetchSessions()
    }
  }, [mounted, fetchSessions])

  const handleCreateSession = async () => {
    if (!newSession.name.trim() || !newSession.cookie.trim()) {
      showToast.error("Por favor complete todos los campos")
      return
    }

    try {
      JSON.parse(newSession.cookie)
    } catch (error) {
      showToast.error("La cookie debe ser un JSON válido")
      return
    }

    try {
      const session = await createSession({
        name: newSession.name,
        cookie: newSession.cookie,
        status: "pending"
      })

      setNewSession({ name: "", cookie: "" })
      setCreateDialogOpen(false)
      setCreateModalMode("choice")
      fetchSessions()
      if (typeof window !== "undefined") {
        localStorage.setItem("selectedSessionId", session.id.toString())
      }
      showToast.success("Sesión creada exitosamente")
    } catch (error) {
      showToast.error("Error al crear la sesión")
    }
  }

  const handleLoginWithCredentials = async () => {
    if (!loginForm.email.trim() || !loginForm.password.trim()) {
      showToast.error("Por favor complete usuario/email y contraseña")
      return
    }

    setLoginLoading(true)
    setLoginStatus("awaiting_2fa")

    try {
      const response = await axios.post("/api/login", {
        email: loginForm.email.trim(),
        password: loginForm.password,
        wait_2fa_seconds: loginForm.wait2faSeconds,
      })

      if (response.data.status === "processing" || response.status === 202) {
        const countBefore = sessions.length
        const maxPolls = Math.ceil((loginForm.wait2faSeconds + 30) / 2.5)
        let pollCount = 0
        pollIntervalRef.current = setInterval(async () => {
          pollCount++
          try {
            const data = await getSessions()
            setSessions(data)
            if (data.length > countBefore) {
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current)
                pollIntervalRef.current = null
              }
              const newSession = data[0]
              if (newSession?.id && typeof window !== "undefined") {
                localStorage.setItem("selectedSessionId", newSession.id.toString())
              }
              setLoginStatus("success")
              showToast.success("¡Cuenta conectada exitosamente!")
              setTimeout(() => {
                setCreateDialogOpen(false)
                setCreateModalMode("choice")
                setLoginStatus("idle")
                setLoginForm({ email: "", password: "", wait2faSeconds: 120 })
              }, 1500)
            }
          } catch {
            // Ignorar errores de poll
          }
          if (pollCount >= maxPolls && pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
            setLoginStatus("idle")
            showToast.error("Tiempo agotado. Intenta de nuevo o agrega la cuenta con cookies.")
          }
        }, 2500)
      } else if (response.data.status === "ok") {
        setLoginForm({ email: "", password: "", wait2faSeconds: 120 })
        setCreateDialogOpen(false)
        setCreateModalMode("choice")
        fetchSessions()
        if (response.data?.session?.id && typeof window !== "undefined") {
          localStorage.setItem("selectedSessionId", response.data.session.id.toString())
        }
        showToast.success("Cuenta conectada exitosamente")
      } else {
        showToast.error(response.data.mensaje || "Error al iniciar sesión")
        setLoginStatus("idle")
      }
    } catch (error: unknown) {
      const msg = axios.isAxiosError(error) && error.response?.data?.mensaje
        ? error.response.data.mensaje
        : "Error al conectar la cuenta"
      showToast.error(msg)
      setLoginStatus("idle")
    } finally {
      setLoginLoading(false)
    }
  }

  const handleCreateDialogOpenChange = (open: boolean) => {
    setCreateDialogOpen(open)
    if (!open) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      setCreateModalMode("choice")
      setLoginForm({ email: "", password: "", wait2faSeconds: 120 })
      setLoginStatus("idle")
    }
  }

  const handleEditSession = async () => {
    if (!currentSession) return

    try {
      await updateSession(currentSession.id, {
        name: currentSession.name,
        cookie: currentSession.cookie
      })

      setEditDialogOpen(false)
      setCurrentSession(null)
      fetchSessions()
      showToast.success("Cuenta actualizada exitosamente")
    } catch (error) {
      showToast.error("Error al actualizar la cuenta")
    }
  }

  const handleVerifySession = useCallback(async (session: Session) => {
    setIsLoading(true)

    try {
      const cookiesList = JSON.parse(session.cookie)

      const response = await axios.post("/api/verify-session", { cookies: cookiesList })

      if (response.data.status_code === 200) {
        await verifySession(session.id, {
          c_user: response.data.c_user,
          user_name: response.data.name,
          name: response.data.name
        })

        fetchSessions()
        // Guardar id de la sesión verificada para usarla en PagesPage
        if (typeof window !== "undefined") {
          localStorage.setItem("selectedSessionId", session.id.toString())
        }
        showToast.success("Cuenta verificada exitosamente")
      } else {
        showToast.error("Error al verificar la cuenta: " + response.data.mensaje)
      }
    } catch (error) {
      showToast.error("Error al verificar la cuenta")
    } finally {
      setIsLoading(false)
    }
  }, [fetchSessions])

  const handleDeleteSession = async () => {
    if (!currentSession) return

    try {
      await deleteSession(currentSession.id)
      setDeleteDialogOpen(false)
      setCurrentSession(null)
      fetchSessions()
      showToast.success("Cuenta eliminada exitosamente")
    } catch (error) {
      showToast.error("Error al eliminar la cuenta")
    }
  }

  const handleDeleteSelected = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows
    if (selectedRows.length === 0) {
      showToast.error("No se han seleccionado registros para eliminar")
      return
    }
    setDeleteMultipleDialogOpen(true)
  }

  const handleDeleteMultiple = async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows
    const selectedIds = selectedRows.map((row) => row.original.id)

    try {
      await Promise.all(selectedIds.map(id => deleteSession(id)))
      setDeleteMultipleDialogOpen(false)
      setRowSelection({})
      fetchSessions()
      showToast.success("Cuentas eliminadas exitosamente")
    } catch (error) {
      showToast.error("Error al eliminar las cuentas")
    }
  }

  const columns = useMemo<ColumnDef<Session>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }: { row: Row<Session> }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "id",
        header: ({ column }: { column: Column<Session> }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="h-8 p-0 font-medium"
            >
              ID
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }: { row: Row<Session> }) => <div className="font-medium">#{row.getValue("id")}</div>,
      },
      {
        accessorKey: "name",
        header: ({ column }: { column: Column<Session> }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="h-8 p-0 font-medium"
            >
              Nombre
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }: { row: Row<Session> }) => {
          const session = row.original
          // Si ya está verificado y tiene user_name, mostramos ese como el principal.
          // Si no, mostramos el nombre manual.
          const displayName = session.user_name || session.name

          return (
            <div>
              <div className="font-medium">{displayName}</div>
              {/* Opcional: Mostrar el nombre original como subtítulo si es diferente y queremos conservarlo, 
                  pero el usuario pidió reemplazarlo. Asi que solo mostramos uno. */}
            </div>
          )
        },
      },
      {
        accessorKey: "c_user",
        header: "C_User",
        cell: ({ row }: { row: Row<Session> }) => {
          const c_user = row.getValue("c_user") as string
          return c_user ? (
            <div className="font-mono text-sm">{c_user}</div>
          ) : (
            <div className="text-gray-400 text-sm">No verificado</div>
          )
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }: { row: Row<Session> }) => {
          const status = row.getValue("status") as string
          const color = statusColors[status]
          const label = statusLabels[status]

          return (
            <span className={`font-medium ${color}`}>
              {label}
            </span>
          )
        },
      },
      {
        accessorKey: "created_at",
        header: ({ column }: { column: Column<Session> }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="h-8 p-0 font-medium"
            >
              Creada
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          )
        },
        cell: ({ row }: { row: Row<Session> }) => {
          const date = new Date(row.getValue("created_at"))
          return <div>{date.toLocaleDateString()}</div>
        },
      },
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }: { row: Row<Session> }) => {
          const session = row.original

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Abrir menú</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    setCurrentSession(session)
                    setDetailsDialogOpen(true)
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Ver detalles
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setCurrentSession(session)
                    setEditDialogOpen(true)
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleVerifySession(session)}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Re-verificar sesión
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setCurrentSession(session)
                    setDeleteDialogOpen(true)
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [handleVerifySession],
  )

  const table = useReactTable({
    data: sessions,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
  })

  if (!mounted) {
    return null
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-gray-900 dark:text-white">Gestión de Cuentas</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Gestione sus cuentas sociales de Facebook y sus cookies desde este panel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between py-4 gap-4">
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <Input
                placeholder="Filtrar por nombre..."
                value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
                onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
                className="max-w-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
              <Button
                variant="outline"
                onClick={handleDeleteSelected}
                disabled={table.getFilteredSelectedRowModel().rows.length === 0}
                className="border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar Seleccionados
              </Button>
              <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
                <DialogTrigger asChild>
                  <Button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Cuenta
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                      {createModalMode !== "choice" && loginStatus === "idle" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 -ml-2"
                          onClick={() => setCreateModalMode("choice")}
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                      )}
                      Conectar Nueva Cuenta
                    </DialogTitle>
                  </DialogHeader>

                  {createModalMode === "choice" && (
                    <div className="space-y-4 py-4">
                      <p className="text-gray-600 dark:text-gray-400 text-sm">
                        Elige cómo deseas agregar tu cuenta de Facebook:
                      </p>
                      <div className="grid gap-3">
                        <Button
                          variant="outline"
                          className="h-auto py-4 justify-start gap-3 border-gray-200 dark:border-gray-700"
                          onClick={() => setCreateModalMode("cookies")}
                        >
                          <Cookie className="h-5 w-5 shrink-0" />
                          <div className="text-left">
                            <div className="font-medium">Agregar con cookies</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Pega las cookies de tu sesión de Facebook manualmente
                            </div>
                          </div>
                        </Button>
                        <Button
                          variant="outline"
                          className="h-auto py-4 justify-start gap-3 border-gray-200 dark:border-gray-700"
                          onClick={() => setCreateModalMode("login")}
                        >
                          <LogIn className="h-5 w-5 shrink-0" />
                          <div className="text-left">
                            <div className="font-medium">Iniciar sesión con usuario y contraseña</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Ingresa tu email/usuario y contraseña de Facebook
                            </div>
                          </div>
                        </Button>
                      </div>
                    </div>
                  )}

                  {createModalMode === "cookies" && (
                    <>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="session-name" className="text-gray-900 dark:text-white block mb-2">
                            Nombre de la Cuenta
                          </Label>
                          <Input
                            id="session-name"
                            value={newSession.name}
                            onChange={(e) => setNewSession({ ...newSession, name: e.target.value })}
                            placeholder="Ej: Cuenta Principal"
                            className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                          />
                        </div>
                        <div>
                          <Label htmlFor="session-cookie" className="text-gray-900 dark:text-white block mb-2">
                            Cookie (JSON)
                          </Label>
                          <Textarea
                            id="session-cookie"
                            value={newSession.cookie}
                            onChange={(e) => setNewSession({ ...newSession, cookie: e.target.value })}
                            placeholder='{"c_user":"123456789","xs":"74%3AypHYvUjlcJKvgw%3A2%3A1640995200%3A-1%3A-1","fr":"0ZvhZQqxOe01mZQ1V..."}'
                            rows={6}
                            className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 font-mono text-sm"
                          />
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Pegue aquí la cookie en formato JSON
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCreateSession} className="bg-[#2563eb] hover:bg-[#1d4ed8]">
                          Conectar Cuenta
                        </Button>
                      </DialogFooter>
                    </>
                  )}

                  {createModalMode === "login" && (
                    <>
                      {loginStatus === "awaiting_2fa" && (
                        <div className="py-8 px-4 text-center space-y-6">
                          <Loader2 className="h-14 w-14 animate-spin text-blue-600 mx-auto" />
                          <div>
                            <p className="text-gray-900 dark:text-white font-medium text-lg">
                              Esperando verificación 2FA
                            </p>
                            <p className="text-gray-600 dark:text-gray-400 mt-2">
                              Aprueba la autenticación en tu dispositivo (teléfono o aplicación).
                            </p>
                            <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">
                              Esto puede tardar 1-2 minutos.
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => handleCreateDialogOpenChange(false)}
                            className="border-gray-200 dark:border-gray-700"
                          >
                            Cancelar
                          </Button>
                        </div>
                      )}

                      {loginStatus === "success" && (
                        <div className="py-8 px-4 text-center space-y-4">
                          <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                            <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                          </div>
                          <p className="text-gray-900 dark:text-white font-medium text-lg">
                            ¡Cuenta conectada exitosamente!
                          </p>
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Cerrando...
                          </p>
                        </div>
                      )}

                      {loginStatus === "idle" && (
                        <>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="login-email" className="text-gray-900 dark:text-white block mb-2">
                                Usuario o Email
                              </Label>
                              <Input
                                id="login-email"
                                type="text"
                                value={loginForm.email}
                                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                                placeholder="Email o nombre de usuario"
                                className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                autoComplete="username"
                              />
                            </div>
                            <div>
                              <Label htmlFor="login-password" className="text-gray-900 dark:text-white block mb-2">
                                Contraseña
                              </Label>
                              <Input
                                id="login-password"
                                type="password"
                                value={loginForm.password}
                                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                                placeholder="Contraseña"
                                className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                                autoComplete="current-password"
                              />
                            </div>
                            <div>
                              <Label htmlFor="login-wait-2fa" className="text-gray-900 dark:text-white block mb-2">
                                Espera 2FA (segundos)
                              </Label>
                              <Input
                                id="login-wait-2fa"
                                type="number"
                                min={10}
                                max={300}
                                value={loginForm.wait2faSeconds}
                                onChange={(e) => setLoginForm({ ...loginForm, wait2faSeconds: parseInt(e.target.value) || 120 })}
                                placeholder="120"
                                className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                              />
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                Tiempo de espera para autenticación 2FA (10-300 segundos)
                              </p>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                              Cancelar
                            </Button>
                            <Button
                              onClick={handleLoginWithCredentials}
                              disabled={loginLoading}
                              className="bg-[#2563eb] hover:bg-[#1d4ed8]"
                            >
                              {loginLoading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Enviando...
                                </>
                              ) : (
                                "Iniciar sesión"
                              )}
                            </Button>
                          </DialogFooter>
                        </>
                      )}
                    </>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="rounded-md border border-gray-200 dark:border-gray-800">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="border-gray-200 dark:border-gray-800">
                      {headerGroup.headers.map((header) => {
                        return (
                          <TableHead key={header.id} className="text-gray-900 dark:text-white">
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className="border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="text-gray-900 dark:text-gray-100">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center text-gray-500 dark:text-gray-400">
                        No hay resultados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-2 py-4">
            <div className="flex-1 text-sm text-gray-500 dark:text-gray-400">
              {table.getFilteredSelectedRowModel().rows.length} de {table.getFilteredRowModel().rows.length} fila(s)
              seleccionada(s).
            </div>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="border-gray-200 dark:border-gray-700"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="border-gray-200 dark:border-gray-700"
              >
                Siguiente
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Session Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Editar Cuenta Social</DialogTitle>
          </DialogHeader>
          {currentSession && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name" className="text-gray-900 dark:text-white block mb-2">
                  Nombre de la Cuenta
                </Label>
                <Input
                  id="edit-name"
                  value={currentSession.name}
                  onChange={(e) => setCurrentSession({ ...currentSession, name: e.target.value })}
                  className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>
              <div>
                <Label htmlFor="edit-cookie" className="text-gray-900 dark:text-white block mb-2">
                  Cookie (JSON)
                </Label>
                <Textarea
                  id="edit-cookie"
                  value={currentSession.cookie}
                  onChange={(e) => setCurrentSession({ ...currentSession, cookie: e.target.value })}
                  rows={6}
                  className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 font-mono text-sm"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSession} className="bg-[#2563eb] hover:bg-[#1d4ed8]">
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">
              Detalles de la Sesión: {currentSession?.name}
            </DialogTitle>
          </DialogHeader>
          {currentSession && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-900 dark:text-white font-medium block mb-1">ID</Label>
                  <p className="text-gray-600 dark:text-gray-400">#{currentSession.id}</p>
                </div>
                <div>
                  <Label className="text-gray-900 dark:text-white font-medium block mb-1">Estado</Label>
                  <div className="mt-1">
                    <span className={`font-medium ${statusColors[currentSession.status]}`}>
                      {statusLabels[currentSession.status]}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-900 dark:text-white font-medium block mb-1">Fecha de Creación</Label>
                  <p className="text-gray-600 dark:text-gray-400">
                    {new Date(currentSession.created_at).toLocaleString()}
                  </p>
                </div>
                {currentSession.verified_at && (
                  <div>
                    <Label className="text-gray-900 dark:text-white font-medium block mb-1">
                      Fecha de Verificación
                    </Label>
                    <p className="text-gray-600 dark:text-gray-400">
                      {new Date(currentSession.verified_at).toLocaleString()}
                    </p>
                  </div>
                )}
                {currentSession.c_user && (
                  <div>
                    <Label className="text-gray-900 dark:text-white font-medium block mb-1">C_User</Label>
                    <p className="text-gray-600 dark:text-gray-400 font-mono">{currentSession.c_user}</p>
                  </div>
                )}
                {currentSession.user_name && (
                  <div>
                    <Label className="text-gray-900 dark:text-white font-medium block mb-1">Nombre de Usuario</Label>
                    <p className="text-gray-600 dark:text-gray-400">{currentSession.user_name}</p>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-gray-900 dark:text-white font-medium block mb-1">Cookie Completa</Label>
                <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                  <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-all font-mono max-h-[400px] overflow-y-auto">
                    {JSON.stringify(JSON.parse(currentSession.cookie), null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailsDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Session Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
              Esta acción no se puede deshacer. Esto eliminará permanentemente la sesión &quot;{currentSession?.name}
              &quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-200 dark:border-gray-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession} className="bg-destructive hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Multiple Sessions Dialog */}
      <AlertDialog open={deleteMultipleDialogOpen} onOpenChange={setDeleteMultipleDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-400">
              Esta acción no se puede deshacer. Esto eliminará permanentemente las{" "}
              {table.getFilteredSelectedRowModel().rows.length} sesiones seleccionadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-200 dark:border-gray-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMultiple} className="bg-destructive hover:bg-destructive/90">
              Eliminar Seleccionadas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
