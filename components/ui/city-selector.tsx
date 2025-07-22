// components/ui/city-selector.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
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

import { useMobile } from "@/hooks/use-mobile";
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
  const isMobile = useMobile();
  const isDesktop = !isMobile;

  const [internalSelection, setInternalSelection] = React.useState<string[]>(selectedCities);
  const [searchTerm, setSearchTerm] = React.useState("");
  
  React.useEffect(() => {
    setInternalSelection(selectedCities);
  }, [selectedCities]);

  React.useEffect(() => {
    if (isOpen) {
      setInternalSelection(selectedCities);
      setSearchTerm("");
    }
  }, [isOpen, selectedCities]);
  
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
      
  const filteredCities = React.useMemo(() =>
    availableCities.filter(city =>
      city.toLowerCase().includes(searchTerm.toLowerCase())
    ), [availableCities, searchTerm]
  );

  const CityListContent = () => (
    <Command>
      <CommandInput 
        placeholder="Buscar cidade..."
        value={searchTerm}
        onValueChange={setSearchTerm}
      />
      <CommandList>
        <CommandEmpty>Nenhuma cidade encontrada.</CommandEmpty>
        <CommandGroup>
          <ScrollArea className="h-[240px]">
            {filteredCities.map(city => (
              <CommandItem
                key={city}
                value={city}
                onSelect={() => handleSelectCity(city)}
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

  if (isDesktop) {
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
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <CityListContent />
          <div className="p-2 border-t flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setInternalSelection([])}>Limpar</Button>
            {/* AQUI ESTÁ A ALTERAÇÃO: Adicionamos o contador ao botão do desktop */}
            <Button size="sm" onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700">
              Confirmar ({internalSelection.length})
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="outline" role="combobox" disabled={isDisabled} aria-expanded={isOpen} className={cn("w-full justify-between font-normal h-9", className)}>
            {triggerButtonText}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mt-4 border-t">
          <CityListContent />
        </div>
        <DrawerFooter className="pt-2 flex-col-reverse">
          <DrawerClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DrawerClose>
          <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700">
            Confirmar ({internalSelection.length})
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}