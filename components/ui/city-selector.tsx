// components/ui/city-selector.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Drawer, DrawerContent, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

// Props foram atualizadas: recebemos a lista final ('selectedCities')
// e uma função 'onConfirm' para enviar a nova lista.
interface CitySelectorProps {
  selectedState: string;
  availableCities: string[];
  selectedCities: string[];
  onConfirm: (cities: string[]) => void;
}

export function CitySelector({
  selectedState,
  availableCities,
  selectedCities,
  onConfirm,
}: CitySelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // ESTADO INTERNO: A chave para resolver o problema do "salto".
  // Gerencia a seleção temporariamente dentro do componente.
  const [internalSelection, setInternalSelection] = React.useState<string[]>(selectedCities);

  // Sincroniza o estado interno com o externo sempre que o popover/drawer abrir.
  React.useEffect(() => {
    if (isOpen) {
      setInternalSelection(selectedCities);
    }
  }, [isOpen, selectedCities]);

  // Atualiza a seleção interna a cada clique.
  const handleSelectCity = (city: string) => {
    setInternalSelection(prev => 
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };

  // Botões de Ação para UX melhorada
  const ActionButtons = () => (
    <div className="p-2 border-t flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setInternalSelection([])}
      >
        Limpar
      </Button>
      <Button
        size="sm"
        onClick={() => {
          onConfirm(internalSelection);
          setIsOpen(false);
        }}
      >
        Confirmar
      </Button>
    </div>
  );

  // A lista de cidades pesquisável
  const CityListContent = () => (
    <Command>
      <CommandInput placeholder="Buscar cidade..." />
      <CommandList className="max-h-[250px] overflow-y-auto">
        <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
        <CommandGroup>
          {availableCities.map((city) => (
            <CommandItem
              key={city}
              value={city}
              onSelect={() => handleSelectCity(city)}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  internalSelection.includes(city) ? "opacity-100" : "opacity-0"
                )}
              />
              {city}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  const triggerButtonText =
    selectedCities.length > 0
      ? `${selectedCities.length} cidade(s) selecionada(s)`
      : "Selecione as cidades...";

  if (isDesktop) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className="w-full justify-between font-normal h-9"
            disabled={!selectedState || availableCities.length === 0}
          >
            {triggerButtonText}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <CityListContent />
          <ActionButtons />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between font-normal h-9"
          disabled={!selectedState || availableCities.length === 0}
        >
          {triggerButtonText}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mt-4">
          <CityListContent />
        </div>
        <DrawerFooter className="pt-2">
           <div className="flex w-full items-center justify-end gap-2">
              <DrawerClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DrawerClose>
              <Button
                onClick={() => {
                  onConfirm(internalSelection);
                  setIsOpen(false);
                }}
              >
                Confirmar
              </Button>
           </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}