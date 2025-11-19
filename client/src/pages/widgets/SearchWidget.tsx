import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Bed, DollarSign } from "lucide-react";

interface SearchWidgetProps {
  size?: 'small' | 'medium' | 'large';
  onSearch?: (params: any) => void;
}

export function SearchWidget({ size = 'medium', onSearch }: SearchWidgetProps) {
  const [location, setLocation] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [beds, setBeds] = useState("");

  const handleSearch = () => {
    onSearch?.({
      location,
      minPrice,
      maxPrice,
      beds,
    });
  };

  if (size === 'small') {
    return (
      <div className="p-4 bg-background border rounded-md max-w-md">
        <div className="flex gap-2">
          <Input
            placeholder="Enter location..."
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleSearch}>
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (size === 'medium') {
    return (
      <div className="p-4 bg-background border rounded-md max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="md:col-span-2"
          />
          <Select value={beds} onValueChange={setBeds}>
            <SelectTrigger>
              <SelectValue placeholder="Beds" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1+</SelectItem>
              <SelectItem value="2">2+</SelectItem>
              <SelectItem value="3">3+</SelectItem>
              <SelectItem value="4">4+</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSearch}>
            <Search className="w-4 h-4 mr-2" />
            Search
          </Button>
        </div>
      </div>
    );
  }

  // Large size
  return (
    <div className="p-6 bg-background border rounded-md">
      <div className="space-y-4">
        <Input
          placeholder="Enter city, neighborhood, or ZIP code"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            type="number"
            placeholder="Min Price"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Max Price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
          <Select value={beds} onValueChange={setBeds}>
            <SelectTrigger>
              <SelectValue placeholder="Bedrooms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1+</SelectItem>
              <SelectItem value="2">2+</SelectItem>
              <SelectItem value="3">3+</SelectItem>
              <SelectItem value="4">4+</SelectItem>
              <SelectItem value="5">5+</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="w-full" onClick={handleSearch}>
          <Search className="w-4 h-4 mr-2" />
          Search Properties
        </Button>
      </div>
    </div>
  );
}
