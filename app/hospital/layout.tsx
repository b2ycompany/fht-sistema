// app/hospital/layout.tsx
import { HospitalSidebar } from "@/components/layouts/HospitalSidebar"; // Ajuste o caminho se necessário

export default function HospitalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr]"> {/* Grid para Sidebar + Conteúdo */}
      <HospitalSidebar />
      <div className="flex flex-col">
        {/* Opcional: Header pode ser adicionado aqui */}
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6 lg:p-8 bg-gray-100/50 dark:bg-transparent"> {/* Área de conteúdo principal */}
          {children}
        </main>
      </div>
    </div>
  );
}