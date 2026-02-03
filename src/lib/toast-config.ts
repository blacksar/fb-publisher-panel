import { toast, type ToastT } from "sonner"

export const toastConfig = {
  position: "bottom-right" as const,
  duration: 3000,
  style: {
    background: "white",
    color: "black",
    border: "1px solid #e5e7eb",
  },
}

// Función helper para mostrar toasts con la configuración global
export const showToast = {
  success: (message: string) => {
    toast.success(message, toastConfig)
  },
  error: (message: string) => {
    toast.error(message, toastConfig)
  },
  info: (message: string) => {
    toast.info(message, toastConfig)
  },
  warning: (message: string) => {
    toast.warning(message, toastConfig)
  },
} 