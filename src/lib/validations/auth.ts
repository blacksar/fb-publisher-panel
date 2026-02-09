import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Email inválido").min(1, "Email requerido"),
  password: z.string().min(1, "Contraseña requerida"),
})

export const createUserSchema = z.object({
  email: z.string().email("Email inválido").min(1, "Email requerido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  name: z.string().optional(),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
})

export type LoginInput = z.infer<typeof loginSchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
