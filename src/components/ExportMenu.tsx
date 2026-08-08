import { Download, FileText, FileType, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  exportBrandedPDF,
  exportBrandedWord,
  exportBrandedCSV,
  type BrandedPDFOptions,
} from "@/lib/exporters";

type Props = {
  /** Builds the report payload lazily so data is always fresh at click time. */
  data: () => BrandedPDFOptions;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "secondary" | "ghost";
  className?: string;
};

/** Unified export control — PDF, Word and CSV from a single branded payload. */
export function ExportMenu({ data, disabled, label = "Export", size = "sm", variant = "outline", className }: Props) {
  const run = (fn: (o: BrandedPDFOptions) => void, kind: string) => {
    try {
      fn(data());
      toast.success(`${kind} export ready`);
    } catch {
      toast.error(`Could not create the ${kind} export`);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} disabled={disabled} className={className}>
          <Download className="size-4" />
          <span className="hidden sm:inline ml-1">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover z-50">
        <DropdownMenuLabel>Download as</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => run(exportBrandedPDF, "PDF")}>
          <FileText className="size-4 mr-2" /> PDF document
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(exportBrandedWord, "Word")}>
          <FileType className="size-4 mr-2" /> Word (.doc)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(exportBrandedCSV, "CSV")}>
          <Sheet className="size-4 mr-2" /> CSV spreadsheet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
