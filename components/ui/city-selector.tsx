// components/ui/city-selector.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerTrigger, DrawerFooter, DrawerClose, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ChevronsUpDown } from "lucide-react";

// Hook customizado para detectar se a visualização é mobile
const useMediaQuery = (query: string) => {
  const [value, setValue] = React.useState(false);
  React.useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setValue(mediaQuery.matches);
    const handler = (event: MediaQueryListEvent) => setValue(event.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);
  return value;
};

// Hook simplificado para verificar se é mobile (useMobile)
const useMobile = () => useMediaQuery("(max-width: 768px)");


import { cn } from "@/lib/utils";

interface CitySelectorProps {
  selectedState: string;
  availableCities: string[];
  selectedCities: string[];
  onConfirm: (cities: string[]) => void;
  className?: string;
}

export function CitySelector({
  selectedState,
  availableCities,
  selectedCities,
  onConfirm,
  className,
}: CitySelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  // Garante que o hook useMobile não cause inconsistências na renderização inicial (SSR)
  const [isMounted, setIsMounted] = React.useState(false);
  const isMobile = useMobile();

  React.useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const [internalSelection, setInternalSelection] = React.useState<string[]>(selectedCities);
  
  React.useEffect(() => {
    setInternalSelection(selectedCities);
  }, [selectedCities]);

  React.useEffect(() => {
    if (isOpen) {
      setInternalSelection(selectedCities);
    }
  }, [isOpen, selectedCities]);
  
  React.useEffect(() => {
      // Ao trocar de estado, limpamos a seleção interna e a confirmada no formulário.
      setInternalSelection([]);
      onConfirm([]);
  }, [selectedState, onConfirm]);


  const handleSelectCity = (city: string) => {
    setInternalSelection(prev => 
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };
  
  const handleConfirm = () => {
    onConfirm(internalSelection);
    setIsOpen(false);
  };
  
  const handleOpenChange = (open: boolean) => {
      // Se o popover/drawer for fechado sem confirmação, reverte a seleção interna para a seleção confirmada.
      if (!open) {
          setInternalSelection(selectedCities);
      }
      setIsOpen(open);
  };

  const isDisabled = !selectedState || availableCities.length === 0;

  const triggerButtonText =
    selectedCities.length > 0
      ? `${selectedCities.length} cidade(s) selecionada(s)`
      : isDisabled ? "Selecione um estado" : "Selecione as cidades...";

  // Componente que renderiza a lista de cidades, reutilizado no Popover e no Drawer.
  const CityListContent = () => (
    <Command>
      <CommandInput placeholder="Buscar cidade..." />
      <CommandList>
        <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
        <CommandGroup>
          {/* Adicionamos uma altura fixa e scroll para a lista de cidades */}
          <ScrollArea className="h-[250px]">
            {availableCities.map(city => (
              <CommandItem
                key={city}
                value={city}
                onSelect={(currentValue) => {
                  // Prevenimos que a seleção feche o Popover/Drawer
                  handleSelectCity(city);
                }}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    internalSelection.includes(city) ? "opacity-100" : "opacity-0"
                  )}
                />
                <span>{city}</span>
              </CommandItem>
            ))}
          </ScrollArea>
        </CommandGroup>
      </CommandList>
    </Command>
  );

  // Apenas renderiza o componente no cliente para evitar erros de hidratação com o useMobile
  if (!isMounted) {
    return (
      <Button variant="outline" disabled={true} className={cn("w-full justify-between font-normal h-9", className)}>
        Carregando...
      </Button>
    );
  }

  // Lógica para renderizar Popover em Desktop
  if (!isMobile) {
    return (
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" disabled={isDisabled} aria-expanded={isOpen} className={cn("w-full justify-between font-normal h-9", className)}>
            {triggerButtonText}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[--radix-popover-trigger-width] p-0" 
          align="start"
        >
          <CityListContent />
          <div className="p-2 border-t flex items-center justify-end gap-2 bg-gray-50">
            <Button variant="ghost" size="sm" onClick={() => setInternalSelection([])}>Limpar</Button>
            <Button size="sm" onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700">
              Confirmar ({internalSelection.length})
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Lógica para renderizar Drawer em Mobile
  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="outline" role="combobox" disabled={isDisabled} aria-expanded={isOpen} className={cn("w-full justify-between font-normal h-9", className)}>
            {triggerButtonText}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DrawerTrigger>
      {/* CORREÇÃO: Estrutura do Drawer para Mobile.
        - Usamos flexbox (`flex flex-col`) para garantir que o conteúdo se ajuste corretamente.
        - O conteúdo principal (lista de cidades) é colocado em um `div` que pode crescer (`flex-grow`) e ter sua própria rolagem.
        - O rodapé (`DrawerFooter`) fica fixo na parte inferior.
      */}
      <DrawerContent className="flex flex-col max-h-[90vh]">
        <DrawerHeader className="flex-shrink-0 text-left">
          <DrawerTitle>Selecione as Cidades</DrawerTitle>
          <DrawerDescription>
            Escolha uma ou mais cidades de atuação.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex-grow overflow-y-auto px-2">
          <CityListContent />
        </div>
        <DrawerFooter className="pt-4 flex-shrink-0 border-t bg-gray-50">
          <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700">
            Confirmar ({internalSelection.length})
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}