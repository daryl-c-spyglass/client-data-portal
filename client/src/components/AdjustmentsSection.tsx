import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RotateCcw, Save, Calculator } from "lucide-react";
import type { CmaAdjustmentRates, CmaAdjustmentsData, CmaCompAdjustmentOverrides } from "@shared/schema";
import {
  DEFAULT_ADJUSTMENT_RATES,
  calculateAdjustments,
  formatAdjustment,
  getUniqueFeatures,
  type PropertyForAdjustment,
  type CompAdjustmentResult,
} from "@/lib/adjustmentCalculations";

interface AdjustmentsSectionProps {
  cmaId: string;
  adjustments: CmaAdjustmentsData | null | undefined;
  subjectProperty: PropertyForAdjustment | null;
  comparables: PropertyForAdjustment[];
  onSave: (adjustments: CmaAdjustmentsData) => Promise<void>;
  isSaving?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatValue(value: string | number | null): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US").format(value);
  }
  return value;
}

export function AdjustmentsSection({
  cmaId,
  adjustments,
  subjectProperty,
  comparables,
  onSave,
  isSaving = false,
}: AdjustmentsSectionProps) {
  const [rates, setRates] = useState<CmaAdjustmentRates>(
    adjustments?.rates || DEFAULT_ADJUSTMENT_RATES
  );
  const [overrides, setOverrides] = useState<Record<string, Partial<CmaCompAdjustmentOverrides>>>(
    adjustments?.compAdjustments || {}
  );
  const [hasChanges, setHasChanges] = useState(false);

  const calculatedResults = useMemo<CompAdjustmentResult[]>(() => {
    if (!subjectProperty || comparables.length === 0) return [];
    return comparables.map((comp) =>
      calculateAdjustments(subjectProperty, comp, rates, overrides[comp.listingId || comp.mlsNumber || comp.id || ""])
    );
  }, [subjectProperty, comparables, rates, overrides]);

  const uniqueFeatures = useMemo(() => getUniqueFeatures(calculatedResults), [calculatedResults]);

  const handleRateChange = (key: keyof CmaAdjustmentRates, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRates((prev) => ({ ...prev, [key]: numValue }));
    setHasChanges(true);
  };

  const handleResetRates = () => {
    setRates(DEFAULT_ADJUSTMENT_RATES);
    setHasChanges(true);
  };

  const handleSave = async () => {
    await onSave({
      rates,
      compAdjustments: overrides as Record<string, CmaCompAdjustmentOverrides>,
      enabled: true,
    });
    setHasChanges(false);
  };

  if (!subjectProperty) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No Subject Property Selected</p>
          <p className="text-sm mt-1">
            Select a subject property to configure adjustments.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (comparables.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No Comparables Selected</p>
          <p className="text-sm mt-1">
            Add comparable properties to calculate adjustments.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Adjustment Rates
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetRates}
            data-testid="button-reset-rates"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset Defaults
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4">
            <div className="flex flex-col">
              <Label htmlFor="sqftPerUnit" className="h-5 mb-2">Sq Ft ($/sqft)</Label>
              <Input
                id="sqftPerUnit"
                type="number"
                value={rates.sqftPerUnit}
                onChange={(e) => handleRateChange("sqftPerUnit", e.target.value)}
                data-testid="input-rate-sqft"
              />
            </div>
            <div className="flex flex-col">
              <Label htmlFor="bedroomValue" className="h-5 mb-2">Bedroom ($)</Label>
              <Input
                id="bedroomValue"
                type="number"
                value={rates.bedroomValue}
                onChange={(e) => handleRateChange("bedroomValue", e.target.value)}
                data-testid="input-rate-bedroom"
              />
            </div>
            <div className="flex flex-col">
              <Label htmlFor="bathroomValue" className="h-5 mb-2">Bathroom ($)</Label>
              <Input
                id="bathroomValue"
                type="number"
                value={rates.bathroomValue}
                onChange={(e) => handleRateChange("bathroomValue", e.target.value)}
                data-testid="input-rate-bathroom"
              />
            </div>
            <div className="flex flex-col">
              <Label htmlFor="poolValue" className="h-5 mb-2">Pool ($)</Label>
              <Input
                id="poolValue"
                type="number"
                value={rates.poolValue}
                onChange={(e) => handleRateChange("poolValue", e.target.value)}
                data-testid="input-rate-pool"
              />
            </div>
            <div className="flex flex-col">
              <Label htmlFor="garagePerSpace" className="h-5 mb-2">Garage ($)</Label>
              <Input
                id="garagePerSpace"
                type="number"
                value={rates.garagePerSpace}
                onChange={(e) => handleRateChange("garagePerSpace", e.target.value)}
                data-testid="input-rate-garage"
              />
            </div>
            <div className="flex flex-col">
              <Label htmlFor="yearBuiltPerYear" className="h-5 mb-2">Year Built ($/yr)</Label>
              <Input
                id="yearBuiltPerYear"
                type="number"
                value={rates.yearBuiltPerYear}
                onChange={(e) => handleRateChange("yearBuiltPerYear", e.target.value)}
                data-testid="input-rate-year"
              />
            </div>
            <div className="flex flex-col">
              <Label htmlFor="lotSizePerSqft" className="h-5 mb-2">Lot Size ($/sqft)</Label>
              <Input
                id="lotSizePerSqft"
                type="number"
                value={rates.lotSizePerSqft}
                onChange={(e) => handleRateChange("lotSizePerSqft", e.target.value)}
                data-testid="input-rate-lot"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Adjustments Comparison</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[600px]">
            <thead>
              <tr className="bg-muted">
                <th className="border p-2 text-left font-medium">Feature</th>
                <th className="border p-2 text-center font-medium bg-blue-50 dark:bg-blue-900/20">
                  Subject
                </th>
                {calculatedResults.map((result) => (
                  <th key={result.compId} colSpan={2} className="border p-2 text-center font-medium">
                    <div className="truncate max-w-[150px]" title={result.compAddress}>
                      {result.compAddress.split(",")[0]}
                    </div>
                  </th>
                ))}
              </tr>
              <tr className="bg-muted/50">
                <th className="border p-2"></th>
                <th className="border p-2 text-center text-xs text-muted-foreground bg-blue-50 dark:bg-blue-900/20">
                  Value
                </th>
                {calculatedResults.map((result) => (
                  <th key={`${result.compId}-header`} colSpan={2} className="border p-2">
                    <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <span>Value</span>
                      <span>Adj</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-muted/30">
                <td className="border p-2 font-medium">Sale Price</td>
                <td className="border p-2 text-center bg-blue-50 dark:bg-blue-900/20">—</td>
                {calculatedResults.map((result) => (
                  <td key={result.compId} colSpan={2} className="border p-2 text-center font-medium">
                    {formatCurrency(result.salePrice)}
                  </td>
                ))}
              </tr>
              
              {uniqueFeatures.map((feature) => {
                const subjectAdj = calculatedResults[0]?.adjustments.find(
                  (a) => a.feature === feature
                );
                return (
                  <tr key={feature}>
                    <td className="border p-2">{feature}</td>
                    <td className="border p-2 text-center bg-blue-50 dark:bg-blue-900/20">
                      {formatValue(subjectAdj?.subjectValue ?? null)}
                    </td>
                    {calculatedResults.map((result) => {
                      const adj = result.adjustments.find((a) => a.feature === feature);
                      return (
                        <td key={result.compId} colSpan={2} className="border p-2">
                          <div className="grid grid-cols-2 gap-1 text-center">
                            <span>{formatValue(adj?.compValue ?? null)}</span>
                            <span
                              className={
                                adj?.adjustment && adj.adjustment > 0
                                  ? "text-green-600 dark:text-green-400 font-medium"
                                  : adj?.adjustment && adj.adjustment < 0
                                  ? "text-red-600 dark:text-red-400 font-medium"
                                  : ""
                              }
                            >
                              {adj ? formatAdjustment(adj.adjustment) : "—"}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              <tr className="bg-muted font-bold">
                <td className="border p-2">Total Adjustment</td>
                <td className="border p-2 text-center bg-blue-50 dark:bg-blue-900/20">—</td>
                {calculatedResults.map((result) => (
                  <td key={result.compId} colSpan={2} className="border p-2 text-center">
                    <span
                      className={
                        result.totalAdjustment > 0
                          ? "text-green-600 dark:text-green-400"
                          : result.totalAdjustment < 0
                          ? "text-red-600 dark:text-red-400"
                          : ""
                      }
                    >
                      {formatAdjustment(result.totalAdjustment)}
                    </span>
                  </td>
                ))}
              </tr>

              <tr className="bg-primary/10 font-bold text-base">
                <td className="border p-2">ADJUSTED PRICE</td>
                <td className="border p-2 text-center bg-blue-100 dark:bg-blue-900/30">—</td>
                {calculatedResults.map((result) => (
                  <td
                    key={result.compId}
                    colSpan={2}
                    className="border p-2 text-center text-primary"
                  >
                    {formatCurrency(result.adjustedPrice)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>

          <div className="mt-4 text-xs text-muted-foreground">
            <span className="text-green-600 dark:text-green-400 font-medium">
              Positive adjustments
            </span>{" "}
            indicate the comparable is inferior to the subject.{" "}
            <span className="text-red-600 dark:text-red-400 font-medium">
              Negative adjustments
            </span>{" "}
            indicate the comparable is superior.
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          data-testid="button-save-adjustments"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Adjustments
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
