"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

// Removed motion import - no animations needed

export function SettingsPage() {
  const [loading, setLoading] = useState(false)
  const [apiUrl, setApiUrl] = useState("")

  useEffect(() => {
    // Cargar configuración actual
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.fb_api_url) {
          setApiUrl(data.fb_api_url)
        }
      })
      .catch((err) => console.error("Error cargando ajustes:", err))
  }, [])

  const handleSave = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fb_api_url: apiUrl }),
      })

      if (res.ok) {
        toast.success("Ajustes guardados correctamente")
      } else {
        toast.error("Error al guardar ajustes")
      }
    } catch (error) {
      toast.error("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Configuración General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-gray-900 dark:text-white block mb-2">Nombre de la aplicación</Label>
              <Input
                id="app-name"
                defaultValue="Dashboard"
                className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              />
            </div>

            <div>
              <Label className="text-gray-900 dark:text-white block mb-2">URL de la API de Facebook</Label>
              <Input
                id="api-url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://facebook-logic..."
                className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              />
              <p className="text-xs text-gray-500 mt-1">URL base para la publicación de posts.</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Notificaciones</h3>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-gray-900 dark:text-white block mb-2">Notificaciones push</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Recibir notificaciones cuando se publiquen posts
                </p>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-gray-900 dark:text-white block mb-2">Notificaciones por email</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">Recibir resúmenes diarios por correo</p>
              </div>
              <Switch />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Automatización</h3>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-gray-900 dark:text-white block mb-2">Auto-publicación</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">Publicar automáticamente posts programados</p>
              </div>
              <Switch defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-gray-900 dark:text-white block mb-2">Sincronización automática</Label>
                <p className="text-sm text-gray-500 dark:text-gray-400">Sincronizar páginas cada hora</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" className="border-gray-200 dark:border-gray-700">
              Cancelar
            </Button>
            <Button
              className="bg-[#2563eb] hover:bg-[#1d4ed8]"
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
