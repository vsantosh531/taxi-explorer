import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@databricks/appkit-ui/react';
import { Check, ChevronsUpDown, X } from 'lucide-react';

interface ZipMultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function ZipMultiSelect({ options, selected, onChange }: ZipMultiSelectProps) {
  const toggle = (zip: string) =>
    onChange(selected.includes(zip) ? selected.filter((z) => z !== zip) : [...selected, zip]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col text-sm gap-1">
        <span id="zip-filter-label">Pickup ZIP</span>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-labelledby="zip-filter-label"
                className="w-48 justify-between font-normal"
              >
                {selected.length === 0 ? 'All ZIPs' : `${selected.length} selected`}
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search ZIP" />
                <CommandList>
                  <CommandEmpty>No ZIP found.</CommandEmpty>
                  <CommandGroup>
                    {options.map((zip) => (
                      <CommandItem key={zip} value={zip} onSelect={() => toggle(zip)}>
                        <Check className={`h-4 w-4 ${selected.includes(zip) ? 'opacity-100' : 'opacity-0'}`} />
                        {zip}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => onChange([])}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1" aria-label="Selected ZIPs">
          {selected.map((zip) => (
            <Badge key={zip} variant="secondary" className="gap-1">
              {zip}
              <button type="button" aria-label={`Remove ${zip}`} onClick={() => toggle(zip)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
