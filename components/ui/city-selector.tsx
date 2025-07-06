// components/ui/city-selector.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandInput } from "@/components/ui/command";
import { Drawer, DrawerContent, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";

import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";

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
  const [internalSelection, setInternalSelection] = React.useState<string[]>(selectedCities);
  const [searchTerm, setSearchTerm] = React.useState("");

  React.useEffect(() => {
    if (isOpen) {
      setInternalSelection(selectedCities);
    }
  }, [isOpen, selectedCities]);

  const handleSelectCity = (city: string) => {
    setInternalSelection(prev => 
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };
  
  const filteredCities = React.useMemo(() =>
    availableCities.filter(city =>
      city.toLowerCase().includes(searchTerm.toLowerCase())
    ), [availableCities, searchTerm]
  );

  const CityListContent = () => (
    <div className="p-2">
      <Command>
        <CommandInput 
          value={searchTerm}
          onValueChange={setSearchTerm}
          placeholder="Buscar cidade..." 
        />
      </Command>
      <div className="mt-2 flex justify-end h-6">
        {internalSelection.length > 0 && (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setInternalSelection([])}>
            Limpar seleção
          </Button>
        )}
      </div>
      {/* Esta é a mudança principal: uma div com rolagem em vez de CommandList */}
      <div className="max-h-[240px] overflow-y-auto pr-1">
        {filteredCities.length > 0 ? (
          filteredCities.map(city => (
            <button
              key={city}
              onClick={() => handleSelectCity(city)}
              className={cn(
                "w-full text-left p-2 text-sm rounded-md flex items-center hover:bg-accent",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              )}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4 shrink-0",
                  internalSelection.includes(city) ? "opacity-100" : "opacity-0"
                )}
              />
              <span>{city}</span>
            </button>
          ))
        ) : (
          <div className="text-center text-sm text-muted-foreground py-8">
            Nenhuma cidade encontrada.
          </div>
        )}
      </div>
    </div>
  );

  const triggerButtonText =
    selectedCities.length > 0
      ? `${selectedCities.length} cidade(s) selecionada(s)`
      : "Selecione as cidades...";

  if (isDesktop) {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={isOpen} className="w-full justify-between font-normal h-9">
            {triggerButtonText}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <CityListContent />
          <div className="p-2 border-t flex justify-end">
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
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={isOpen} className="w-full justify-between font-normal h-9">
            {triggerButtonText}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mt-4 border-t">
          <CityListContent />
        </div>
        {/* Rodapé com UX melhorada para mobile */}
        <DrawerFooter className="pt-2 flex-col-reverse">
          <DrawerClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DrawerClose>
          <Button
            onClick={() => {
              onConfirm(internalSelection);
              setIsOpen(false);
            }}
          >
            Confirmar ({internalSelection.length})
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}