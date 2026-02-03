import { NextResponse } from "next/server"

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '10mb',
  },
}

import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const cleanHeaders = new Headers(request.headers)
    cleanHeaders.delete("cookie")
    const body = await request.json()

    // Obtener URL de API desde configuración
    const apiSetting = await prisma.setting.findUnique({ where: { key: "fb_api_url" } })
    const base = (apiSetting?.value || "").trim().replace(/\/+$/, "")
    if (!base) {
      return new NextResponse(JSON.stringify({ status_code: 400, mensaje: "Configura la URL de la API en Ajustes primero" }), { status: 400, headers: { "Content-Type": "application/json" } })
    }
    const url = `${base}/get_session/`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch (error: any) {
    console.error('Error:', error)
    return new NextResponse(
      JSON.stringify({
        status_code: 500,
        mensaje: error.message || "Error al verificar la sesión"
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    )
  }
} 