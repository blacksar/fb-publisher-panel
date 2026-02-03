"use client"

import { useState, useEffect, useCallback } from "react"
// Removed motion import - no animations needed
import { Search, RefreshCw, Plus, Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import axios from "axios"
import { showToast } from "@/lib/toast-config"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { Checkbox } from "@/components/ui/checkbox"
import { addPagesToSelection, removePageFromSelection, removePagesFromSelection } from "@/app/actions"

interface Page {
  id: string
  name: string
  posts_count: number
  is_syncing: boolean
  is_selected: boolean
}

interface SessionOption {
  id: number
  name: string
  user_name?: string | null
  status: string
}

export function PagesPage() {
  const [myPages, setMyPages] = useState<Page[]>([])
  const [availablePages, setAvailablePages] = useState<Page[]>([])
  const [sessions, setSessions] = useState<SessionOption[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string | "">("")
  const [mounted, setMounted] = useState(false)
  const [sessionsLoaded, setSessionsLoaded] = useState(false)

  // Session guard
  const selectedSession = sessions.find(s => s.id.toString() === selectedSessionId)
  const isSessionInactive = selectedSession?.status === "inactive" || selectedSession?.status === "pending"

  // Search states
  const [searchTerm, setSearchTerm] = useState("")
  const [modalSearchTerm, setModalSearchTerm] = useState("")

  // Loading states
  const [isLoadingMyPages, setIsLoadingMyPages] = useState(false)
  const [isLoadingModal, setIsLoadingModal] = useState(false)

  // Modal & Selection states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pagesToSelect, setPagesToSelect] = useState<string[]>([])
  const [isAdding, setIsAdding] = useState(false)

  // Remote selection states
  const [pagesToRemove, setPagesToRemove] = useState<string[]>([])
  const [isRemoving, setIsRemoving] = useState(false)

  // Cargar selectedSessionId desde localStorage solo después de montar
  useEffect(() => {
    setMounted(true)
  }, [])
  useEffect(() => {
    if (!mounted || sessions.length === 0) return
    const stored = localStorage.getItem('selectedSessionId')
    if (stored && sessions.some(s => s.id.toString() === stored)) {
      setSelectedSessionId(stored)
    } else {
      const first = sessions.find(s => s.status === 'verified') || sessions[0]
      setSelectedSessionId(first.id.toString())
      localStorage.setItem('selectedSessionId', first.id.toString())
    }
  }, [mounted, sessions])

  // Fetch "My Pages" (Only selected from DB/Cache)
  const fetchMyPages = useCallback(async () => {
    if (!selectedSessionId) {
      setMyPages([])
      return
    }
    try {
      setIsLoadingMyPages(true)
      const payload = { sessionId: parseInt(selectedSessionId, 10) }
      const response = await axios.post("/api/get-pages", payload, { timeout: 60000 })
      setIsLoadingMyPages(false)

      if ((response.data.status === "ok" && response.data.resultado?.status_code === 200) ||
        response.data.status === "updated" || response.data.status === "cached") {

        let pagesArray: Page[] = []
        if (response.data.status === "ok") {
          const raw = response.data.resultado?.resultado
          pagesArray = (JSON.parse(raw) as any[]).map(p => ({
            id: p.id, name: p.name, posts_count: 0, is_syncing: false, is_selected: p.is_selected ?? false
          }))
        } else {
          pagesArray = (response.data.pages as any[]).map(p => ({
            id: p.id, name: p.name, posts_count: 0, is_syncing: false, is_selected: p.is_selected ?? false
          }))
        }

        setMyPages(pagesArray.filter(p => p.is_selected))
      } else {
        const msg = response.data?.mensaje || "Error al obtener mis páginas"
        if (msg.includes("sesion") || response.status === 404) {
          setSelectedSessionId("")
          localStorage.removeItem('selectedSessionId')
          showToast.error("No hay sesiones. Agrega una cuenta en Cuentas Sociales primero.")
        } else {
          showToast.error(msg)
        }
      }
    } catch (error: any) {
      setIsLoadingMyPages(false)
      const status = error.response?.status
      const msg = error.response?.data?.mensaje || ""
      if (status === 404 || msg.includes("sesion")) {
        setSelectedSessionId("")
        localStorage.removeItem('selectedSessionId')
        showToast.error("No hay sesiones. Agrega una cuenta en Cuentas Sociales primero.")
      } else {
        showToast.error("Error al obtener mis páginas")
      }
    }
  }, [selectedSessionId])

  // Fetch "Available Pages" (Fresh from API)
  const fetchAvailablePages = useCallback(async () => {
    // Si la sesión está inactiva, no permitir llamada a la API
    if (isSessionInactive) {
      showToast.error("La cuenta está inactiva. Verifíquela nuevamente.")
      return
    }

    try {
      setIsLoadingModal(true)
      const payload: any = selectedSessionId ? { sessionId: parseInt(selectedSessionId, 10) } : {}
      payload.refresh = true // FORCE FRESH from FB

      const response = await axios.post("/api/get-pages", payload, { timeout: 60000 })
      setIsLoadingModal(false)

      if ((response.data.status === "ok" && response.data.resultado?.status_code === 200) ||
        response.data.status === "updated" || response.data.status === "cached") {

        let pagesArray: Page[] = []
        if (response.data.status === "ok") {
          const raw = response.data.resultado.resultado
          pagesArray = (JSON.parse(raw) as any[]).map(p => ({
            id: p.id, name: p.name, posts_count: 0, is_syncing: false, is_selected: p.is_selected ?? false
          }))
        } else {
          pagesArray = (response.data.pages as any[]).map(p => ({
            id: p.id, name: p.name, posts_count: 0, is_syncing: false, is_selected: p.is_selected ?? false
          }))
        }

        // Filter ONLY NOT selected for the modal view
        setAvailablePages(pagesArray.filter(p => !p.is_selected))

        // Also update myPages with the fresh selected ones to keep sync
        setMyPages(pagesArray.filter(p => p.is_selected))
      } else {
        showToast.error(response.data.mensaje || "Error al obtener páginas disponibles")
      }
    } catch (error: any) {
      setIsLoadingModal(false)
      const msg = error.response?.data?.mensaje || error.message || "Error al obtener páginas disponibles"
      showToast.error(msg)
    }
  }, [selectedSessionId])

  // Initial load
  useEffect(() => {
    if (selectedSessionId) {
      void fetchMyPages()
    }
  }, [fetchMyPages, selectedSessionId])

  // Sessions load
  useEffect(() => {
    ; (async () => {
      try {
        const res = await fetch('/api/list-sessions')
        const data = await res.json()
        if (data.status === 'ok') {
          const formattedSessions = data.sessions.map((session: any) => ({
            id: session.id,
            name: session.name,
            user_name: session.user_name,
            status: session.status
          }))
          setSessions(formattedSessions)
        }
      } catch { }
      finally { setSessionsLoaded(true) }
    })()
  }, [])

  // Modal open logic
  useEffect(() => {
    if (isModalOpen) {
      setPagesToSelect([])
      setModalSearchTerm("")
      setAvailablePages([]) // Clear previous state to show loading
      void fetchAvailablePages() // Load fresh
    }
  }, [isModalOpen, fetchAvailablePages])

  // Clear selection when changing session
  useEffect(() => {
    setPagesToRemove([])
  }, [selectedSessionId])


  const handleRemovePage = async (pageId: string) => {
    setMyPages(prev => prev.filter(p => p.id !== pageId)) // Optimistic remove
    setPagesToRemove(prev => prev.filter(id => id !== pageId))

    const res = await removePageFromSelection(pageId)
    if (!res.success) {
      fetchMyPages() // Revert/Reload on error
      showToast.error("Error al eliminar página")
    }
  }

  const handleRemoveSelectedPages = async () => {
    if (pagesToRemove.length === 0) return
    setIsRemoving(true)

    // Optimistic remove
    const idsToRemove = [...pagesToRemove]
    setMyPages(prev => prev.filter(p => !idsToRemove.includes(p.id)))
    setPagesToRemove([])

    const res = await removePagesFromSelection(idsToRemove)
    if (res.success) {
      showToast.success(`${idsToRemove.length} páginas eliminadas`)
    } else {
      fetchMyPages() // Revert
      showToast.error("Error al eliminar páginas seleccionadas")
    }
    setIsRemoving(false)
  }

  const handleAddSelectedPages = async () => {
    if (pagesToSelect.length === 0) return
    setIsAdding(true)

    // Add to myPages optimistically
    const selectedObjects = availablePages.filter(p => pagesToSelect.includes(p.id))
    setMyPages(prev => [...prev, ...selectedObjects.map(p => ({ ...p, is_selected: true }))])

    const res = await addPagesToSelection(pagesToSelect)

    if (res.success) {
      showToast.success(`${pagesToSelect.length} páginas agregadas`)
      setIsModalOpen(false)
    } else {
      fetchMyPages() // Revert
      showToast.error("Error al agregar páginas")
    }
    setIsAdding(false)
  }

  const togglePageInModal = (pageId: string) => {
    setPagesToSelect(prev =>
      prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId]
    )
  }

  const toggleAllInModal = (filteredList: Page[]) => {
    if (filteredList.every(p => pagesToSelect.includes(p.id))) {
      setPagesToSelect(prev => prev.filter(id => !filteredList.some(p => p.id === id))) // Unselect all visible
    } else {
      const newIds = filteredList.map(p => p.id).filter(id => !pagesToSelect.includes(id))
      setPagesToSelect(prev => [...prev, ...newIds]) // Select all visible
    }
  }

  const togglePageToRemove = (pageId: string) => {
    setPagesToRemove(prev =>
      prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId]
    )
  }

  const toggleAllToRemove = (filteredList: Page[]) => {
    if (filteredList.every(p => pagesToRemove.includes(p.id))) {
      setPagesToRemove(prev => prev.filter(id => !filteredList.some(p => p.id === id)))
    } else {
      const newIds = filteredList.map(p => p.id).filter(id => !pagesToRemove.includes(id))
      setPagesToRemove(prev => [...prev, ...newIds])
    }
  }

  const filteredMyPages = myPages.filter(
    (page) => page.name.toLowerCase().includes(searchTerm.toLowerCase()) || page.id.includes(searchTerm),
  )

  const filteredAvailable = availablePages.filter(
    (page) => page.name.toLowerCase().includes(modalSearchTerm.toLowerCase()) || page.id.includes(modalSearchTerm),
  )

  return (
    <div className="space-y-6">
      {sessionsLoaded && sessions.length === 0 && (
        <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sin cuentas</AlertTitle>
          <AlertDescription>
            No hay sesiones configuradas. Ve a <strong>Cuentas Sociales</strong> y agrega una cuenta de Facebook para ver tus páginas.
          </AlertDescription>
        </Alert>
      )}
      {/* WARNING ALERT */}
      {sessionsLoaded && selectedSessionId && isSessionInactive && (
        <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900 mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cuenta Inactiva</AlertTitle>
          <AlertDescription>
            La cuenta seleccionada ha caducado o no está verificada. Por seguridad, las funciones de API están bloqueadas.
            Por favor, vaya a "Cuentas Sociales" y verifique la cuenta nuevamente para continuar.
          </AlertDescription>
        </Alert>
      )}
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <CardTitle className="text-gray-900 dark:text-white">Mis Páginas ({myPages.length})</CardTitle>
            <div className="flex items-center space-x-4">
              <Select
                value={selectedSessionId}
                onValueChange={(val) => {
                  setSelectedSessionId(val)
                  if (typeof window !== "undefined") localStorage.setItem("selectedSessionId", val)
                }}
              >
                <SelectTrigger className="w-48 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <SelectValue placeholder="Selecciona sesión" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {(s.user_name || s.name).split(" ")[0]} {s.status !== 'verified' && s.status !== 'active' ? '(Inactiva)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar en mis páginas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                />
              </div>

              {pagesToRemove.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={handleRemoveSelectedPages}
                  disabled={isRemoving || isSessionInactive}
                  size="sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar ({pagesToRemove.length})
                </Button>
              )}

              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      setAvailablePages([]) // Clear old data
                      setPagesToSelect([])
                      if (!isSessionInactive) {
                        setTimeout(fetchAvailablePages, 100) // Auto fetch after open
                      }
                    }}
                    disabled={!selectedSessionId || isSessionInactive}
                    className={isSessionInactive ? "opacity-50 cursor-not-allowed" : "bg-[#2563eb] hover:bg-[#1d4ed8]"}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Páginas
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 h-[80vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle>Agregar Páginas Disponibles</DialogTitle>
                  </DialogHeader>

                  <div className="flex items-center space-x-2 my-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Buscar disponibles..."
                        value={modalSearchTerm}
                        onChange={(e) => setModalSearchTerm(e.target.value)}
                        className="pl-10 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      />
                    </div>
                    <Button onClick={() => fetchAvailablePages()} disabled={isLoadingModal} variant="outline" size="icon" title="Recargar">
                      <RefreshCw className={`w-4 h-4 ${isLoadingModal ? "animate-spin" : ""}`} />
                    </Button>
                  </div>

                  <div className="flex-1 overflow-auto border rounded-md relative">
                    {isLoadingModal ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 z-20 backdrop-blur-sm">
                        <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-4" />
                        <p className="text-gray-600 dark:text-gray-300 font-medium">Obteniendo páginas desde Facebook...</p>
                        <p className="text-xs text-gray-500 mt-2">Esto puede tardar unos segundos.</p>
                      </div>
                    ) : null}

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={filteredAvailable.length > 0 && filteredAvailable.every(p => pagesToSelect.includes(p.id))}
                              onCheckedChange={() => toggleAllInModal(filteredAvailable)}
                            />
                          </TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAvailable.map(page => (
                          <TableRow key={page.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <TableCell>
                              <Checkbox
                                checked={pagesToSelect.includes(page.id)}
                                onCheckedChange={() => togglePageInModal(page.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{page.name}</TableCell>
                            <TableCell className="font-mono text-xs text-gray-500">{page.id}</TableCell>
                          </TableRow>
                        ))}
                        {!isLoadingModal && filteredAvailable.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center text-gray-500">
                              No hay nuevas páginas disponibles.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-gray-500">{pagesToSelect.length} seleccionadas</span>
                    <Button onClick={handleAddSelectedPages} disabled={pagesToSelect.length === 0 || isAdding}>
                      {isAdding ? "Agregando..." : "Agregar a mis páginas"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-gray-200 dark:border-gray-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={filteredMyPages.length > 0 && filteredMyPages.every(p => pagesToRemove.includes(p.id))}
                      onCheckedChange={() => toggleAllToRemove(filteredMyPages)}
                    />
                  </TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>ID de Página</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMyPages.map((page) => (
                  <TableRow key={page.id} className="border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <TableCell>
                      <Checkbox
                        checked={pagesToRemove.includes(page.id)}
                        onCheckedChange={() => togglePageToRemove(page.id)}
                      />
                    </TableCell>
                    <TableCell className="text-gray-900 dark:text-gray-100 font-medium">{page.name}</TableCell>
                    <TableCell className="text-gray-900 dark:text-gray-100 font-mono text-sm">{page.id}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleRemovePage(page.id)} title="Remover">
                        <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!isLoadingMyPages && filteredMyPages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No tienes páginas guardadas. <br />
                Haz clic en "Agregar Páginas" para comenzar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}