import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { PropertyDetail } from "@/components/PropertyDetail";
import type { Property, Media } from "@shared/schema";

export default function PropertyDetailPage() {
  const [, params] = useRoute("/properties/:id");
  
  // Mock data - will be replaced with real data fetching in phase 3
  const mockProperty: Property = {
    id: params?.id || "1",
    listingId: "12345",
    mlgCanView: true,
    modificationTimestamp: new Date(),
    originatingSystemModificationTimestamp: new Date(),
    listPrice: "450000",
    standardStatus: "Active",
    propertyType: "Residential",
    propertySubType: "Single Family Residential",
    unparsedAddress: "123 Main St, Austin, TX 78745",
    streetNumber: "123",
    streetName: "Main St",
    city: "Austin",
    stateOrProvince: "TX",
    postalCode: "78745",
    latitude: "30.2672",
    longitude: "-97.7431",
    bedroomsTotal: 3,
    bathroomsTotalInteger: 2,
    bathroomsFull: 2,
    bathroomsHalf: 0,
    livingArea: "1850",
    lotSizeSquareFeet: "7500",
    lotSizeAcres: "0.17",
    yearBuilt: 1985,
    daysOnMarket: 12,
    listingContractDate: new Date(),
    publicRemarks: "Beautiful home in a great neighborhood. Recently updated with modern finishes throughout. Spacious backyard perfect for entertaining. Close to schools, parks, and shopping.",
    mlsId: "ACTRIS",
    closeDate: null,
    priceChangeTimestamp: null,
    unitNumber: null,
    subdivision: null,
    neighborhood: "Hyde Park",
    elementarySchool: "Pecan Springs Elementary",
    middleOrJuniorSchool: "Martin Middle School",
    highSchool: "Austin High School",
    schoolDistrict: "Austin ISD",
    mlsAreaMajor: null,
    listAgentMlsId: null,
    listOfficeMlsId: null,
    additionalData: null,
  };

  const mockMedia: Media[] = [];

  const handleAddToCMA = () => {
    console.log("Add to CMA");
  };

  const handleSave = () => {
    console.log("Save property");
  };

  const handleShare = () => {
    console.log("Share property");
  };

  const handleScheduleViewing = () => {
    console.log("Schedule viewing");
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/properties">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-to-properties">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Properties
          </Button>
        </Link>
      </div>

      <PropertyDetail
        property={mockProperty}
        media={mockMedia}
        onAddToCMA={handleAddToCMA}
        onSave={handleSave}
        onShare={handleShare}
        onScheduleViewing={handleScheduleViewing}
      />
    </div>
  );
}
