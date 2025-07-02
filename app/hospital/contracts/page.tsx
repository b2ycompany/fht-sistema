"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";

export default function HospitalContractsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="p-10 border-4 border-red-500">
        <h1 className="text-2xl font-bold mb-4">Página de Teste</h1>
        <p className="mb-4">Clique no botão para testar o pop-up.</p>

        <AlertDialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="lg">
              Abrir Pop-up de Teste
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Teste de Pop-up</AlertDialogTitle>
              <AlertDialogDescription>
                Se você está vendo isto, o componente funciona.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setIsModalOpen(false)}>Fechar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </div>
  );
}