"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Calendar, Clock, FileText, Home, LogOut, Menu, MessageSquare, User, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useMobile } from "@/hooks/use-mobile"
import { useAuth } from "@/components/auth-provider"
import { logoutUser } from "@/lib/auth-service"
import Image from "next/image"
import Logo from "@/public/logo-fht.svg"
import { cn } from "@/lib/utils"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()
  const isMobile = useMobile()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  const handleLogout = async () => {
    try {
      await logoutUser()
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      })
      router.push("/")
    } catch (error) {
      console.error("Logout error:", error)
      toast({
        title: "Erro ao sair",
        description: "Ocorreu um erro ao fazer logout. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: <Home className="h-5 w-5" /> },
    { href: "/dashboard/profile", label: "Meu Perfil", icon: <User className="h-5 w-5" /> },
    { href: "/dashboard/availability", label: "Disponibilidade", icon: <Calendar className="h-5 w-5" /> },
    { href: "/dashboard/proposals", label: "Propostas", icon: <MessageSquare className="h-5 w-5" /> },
    { href: "/dashboard/contracts", label: "Meus Contratos", icon: <FileText className="h-5 w-5" /> },
    { href: "/dashboard/checkin", label: "Check-in/out", icon: <Clock className="h-5 w-5" /> },
    
    
  ]

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Botão de Menu Mobile */}
      <button
        className="md:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-full shadow-md text-blue-600 hover:bg-blue-50 transition-colors"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
      >
        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          "bg-gradient-to-b from-white to-blue-50 border-r border-blue-100 shadow-lg",
          "fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-300 ease-in-out",
          isMobile && !isMobileMenuOpen ? "-translate-x-full" : "translate-x-0",
          "md:static md:translate-x-0 md:shadow-md"
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-blue-100">
          <Image src={Logo} alt="FHT Soluções Hospitalares" width={150} height={50} className="w-auto h-10" />
        </div>

        {/* Navegação */}
        <nav className="px-3 py-4 flex-1">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-all duration-200",
                    pathname === item.href
                      ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                      : "text-gray-700 hover:bg-blue-100 hover:text-blue-600"
                  )}
                  onClick={() => isMobile && setIsMobileMenuOpen(false)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Botão Logout */}
        <div className="p-4 border-t border-blue-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md border border-blue-600 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors text-sm font-medium"
          >
            <LogOut className="h-4 w-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Overlay Mobile */}
      {isMobile && isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 md:p-8">
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}