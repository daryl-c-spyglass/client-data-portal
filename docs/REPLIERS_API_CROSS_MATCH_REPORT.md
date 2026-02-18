# Repliers API Parameter Cross-Match Report

**Date:** February 18, 2026  
**Baseline Count (status=A, no filters):** 29,753 active listings  
**API Endpoint:** `GET https://api.repliers.io/listings`

---

## 1. Aggregates Available

The `aggregates=true` parameter did not return a recognized `aggregates` key in the response. The `aggregates=propertyType` syntax also returned an array rather than a keyed object. **Aggregates endpoint may not be enabled for this board/API key configuration.**

---

## 2. Parameter Test Results

### Legend
- **WORKS** = Count differs meaningfully from baseline (29,753), confirming filtering is applied
- **IGNORED** = Count equals baseline (29,753), parameter has no effect
- **ERROR** = API returns an error response or malformed data
- **0 results** = Returns 0 (may indicate wrong parameter name, wrong value format, or genuinely no matches)

### Property Details

| Parameter | Test Query | Result | Count | Notes |
|-----------|-----------|--------|-------|-------|
| `minYearBuilt` | `minYearBuilt=2020` | **WORKS** | 8,414 | Scales correctly: 2024 returns 5,072 |
| `maxYearBuilt` | `maxYearBuilt=2000` | **WORKS** | 8,602 | Combined range works: 1900-1950 returns 1,014 |
| `minLotSize` | `minLotSize=10000` | **IGNORED** | 29,753 | Even 100,000 returns baseline |
| `maxLotSize` | `maxLotSize=5000` | **IGNORED** | 29,753 | Parameter not supported |
| `minLotSizeAcres` | `minLotSizeAcres=1` | **IGNORED** | 29,753 | Even 10 acres returns baseline |
| `minGarageSpaces` | `minGarageSpaces=2` | **WORKS** | 14,546 | Scales: 3 -> 2,352; 4 -> 438 |
| `garage=true` | `garage=true` | 0 results | 0 | Boolean format not supported |
| `stories=1` | `stories=1` | **IGNORED** | 29,753 | Not a valid filter parameter |
| `minStories` | `minStories=2` | **WORKS** | 129 | Scales: 3 -> 20 |
| `minBeds/maxBeds` | Already implemented | **WORKS** | Varies | Confirmed working |
| `minBaths/maxBaths` | Already implemented | **WORKS** | Varies | Confirmed working |
| `minSqft/maxSqft` | Already implemented | **WORKS** | Varies | Confirmed working |
| `minPrice/maxPrice` | Already implemented | **WORKS** | Varies | Confirmed working |

### Features / Amenities

| Parameter | Test Query | Result | Count | Notes |
|-----------|-----------|--------|-------|-------|
| `pool=true` | `pool=true` | **IGNORED** | 29,753 | Not a valid filter |
| `hasPool=true` | `hasPool=true` | **IGNORED** | 29,753 | Not a valid filter |
| `swimmingPool=true` | `swimmingPool=true` | 0 results | 0 | Wrong format |
| `waterfront=true` | `waterfront=true` | 0 results | 0 | Not a valid boolean filter |
| `waterfront=Yes` | `waterfront=Yes` | 0 results | 0 | Not supported as direct param |
| `newConstruction=true` | `newConstruction=true` | **IGNORED** | 29,753 | Not a valid filter |
| `gatedCommunity=true` | `gatedCommunity=true` | **IGNORED** | 29,753 | Not a valid filter |

### Location

| Parameter | Test Query | Result | Count | Notes |
|-----------|-----------|--------|-------|-------|
| `city` (single) | `city=Austin` | **WORKS** | 8,708 | Confirmed working |
| `city` (multi, comma) | `city=Austin,Round Rock` | 0 results | 0 | Comma-separated NOT supported |
| `city` (multi, pipe) | `city=Austin\|Round Rock` | 0 results | 0 | Pipe-separated NOT supported |
| `zip` (single) | `zip=78759` | **WORKS** | 197 | Confirmed working |
| `zip` (multi, comma) | `zip=78759,78758` | 0 results | 0 | Multi-zip NOT supported |
| `subdivision` | `subdivision=Shady Hollow` | **IGNORED** | 29,753 | Parameter ignored in query |
| `subdivision` | `subdivision=Circle C Ranch` | **IGNORED** | 29,753 | Parameter ignored |
| `county` | `county=Travis` | **IGNORED** | 29,753 | Not a valid filter parameter |
| `county` | `county=Williamson` | **IGNORED** | 29,753 | Not a valid filter parameter |
| `area` | `area=Austin` | **WORKS** | 12 | Works but very few results (MLS-specific "area" concept) |
| `neighborhood` | `neighborhood=Barton Creek` | **WORKS** | 1 | Works for Repliers neighborhood names |
| `lat/long + radius` | `lat=30.26&long=-97.74&radius=5` | **WORKS** | 2,737 | Scales correctly: r=2->532, r=10->4,776 |
| `minLat/maxLat/minLng/maxLng` | Bounding box | **IGNORED** | 29,753 | Bbox params NOT supported; use lat/long/radius instead |
| `minLotFrontage` | `minLotFrontage=50` | **IGNORED** | 29,753 | Not supported |

### Schools

| Parameter | Test Query | Result | Count | Notes |
|-----------|-----------|--------|-------|-------|
| `schoolDistrict` | `schoolDistrict=Austin ISD` | **IGNORED** | 29,753 | Not a valid direct filter |
| `schoolDistrict` | `schoolDistrict=Eanes ISD` | **IGNORED** | 29,753 | Not a valid direct filter |
| `raw.ElementarySchool=contains:` | `raw.ElementarySchool=contains:Barton` | **WORKS** | 97 | Raw field filtering works! |
| `raw.HighSchool=contains:` | `raw.HighSchool=contains:Austin` | **WORKS** | 1,785 | Raw field filtering works |
| `raw.MiddleOrJuniorSchool=contains:` | `raw.MiddleOrJuniorSchool=contains:Bailey` | **WORKS** | 142 | Raw field filtering works |
| `raw.HighSchoolDistrict` | Not tested directly | Likely **WORKS** | - | Field exists in raw data |
| `raw.SchoolDistrict=` | `raw.SchoolDistrict=Austin ISD` | 0 results | 0 | Field name may not exist; use `raw.HighSchoolDistrict` |

### HOA

| Parameter | Test Query | Result | Count | Notes |
|-----------|-----------|--------|-------|-------|
| `maxHoaFee=500` | `maxHoaFee=500` | **IGNORED** | 29,753 | Not a valid filter |
| `hoaFee=0` | `hoaFee=0` | **IGNORED** | 29,753 | Not a valid filter |
| `maxHoaFee=100` | `maxHoaFee=100` | **IGNORED** | 29,753 | Not a valid filter |
| `raw.AssociationFee=contains:0` | `raw.AssociationFee=contains:0` | **WORKS** | 7,092 | Contains match (matches "0", "100", "200", etc.) |

### Date Filters

| Parameter | Test Query | Result | Count | Notes |
|-----------|-----------|--------|-------|-------|
| `minListDate` | `minListDate=2025-01-01` | **WORKS** | 27,871 | Confirmed working |
| `minSoldDate` | `minSoldDate=2025-01-01&status=U&lastStatus=Sld` | **WORKS** | 37,682 | Works for sold listings |
| `maxDaysOnMarket` | `maxDaysOnMarket=30` | **ERROR** | - | Returns array, not standard response |
| `minDaysOnMarket` | `minDaysOnMarket=30` | **ERROR** | - | Returns array, not standard response |

### Transaction / Sort

| Parameter | Test Query | Result | Count | Notes |
|-----------|-----------|--------|-------|-------|
| `type=sale` | `type=sale` | **WORKS** | 22,384 | Filters out lease/rental listings |
| `sortBy=listPriceAsc` | `sortBy=listPriceAsc` | **WORKS** | - | Confirmed sorting correctly |
| `sortBy=createdOnDesc` | `sortBy=createdOnDesc` | **WORKS** | 29,753 | Sort applied, count unchanged |

### Advanced Operators

| Parameter | Test Query | Result | Count | Notes |
|-----------|-----------|--------|-------|-------|
| `contains:features=pool` | `contains:features=pool` | **IGNORED** | 29,753 | Prefix syntax on non-raw fields doesn't work |
| `not:propertyType=Condo` | `not:propertyType=Condo` | **IGNORED** | 29,753 | `not:` prefix on standard fields doesn't work |
| `not:city=Austin` | `not:city=Austin` | **IGNORED** | 29,753 | `not:` prefix doesn't work |
| `operator=or` | With multi-city | 0 results | 0 | Doesn't help with comma-separated values |
| `operator=or:city` | With multi-city | 0 results | 0 | Doesn't help |
| `raw.X=notContains:` | `raw.PropertySubType=notContains:Condominium` | **WORKS** | 27,071 | Exclusion on raw fields works! |

### Raw Field Filtering (the key discovery)

| Parameter | Test Query | Result | Count | Notes |
|-----------|-----------|--------|-------|-------|
| `raw.PropertySubType=` | `=Single Family Residence` | **WORKS** | 16,307 | Exact match |
| `raw.PropertySubType=contains:` | `=contains:Townhouse` | **WORKS** | 473 | Contains match |
| `raw.PropertySubType=notContains:` | `=notContains:Condominium` | **WORKS** | 27,071 | Exclusion works |
| `raw.CountyOrParish=` | `=Travis` | **WORKS** | 11,778 | Exact match on county |
| `raw.PoolFeatures=contains:` | `=contains:Pool` | **WORKS** | 1,096 | Feature search works |
| `raw.GarageSpaces=contains:` | `=contains:2` | **WORKS** | 12,215 | Partial match (includes 2, 20, etc.) |
| `raw.Appliances=contains:` | `=contains:Dishwasher` | **WORKS** | 18,386 | Feature search |
| `raw.Heating=contains:` | `=contains:Central` | **WORKS** | 18,615 | Feature search |
| `raw.Cooling=contains:` | `=contains:Central` | **WORKS** | 21,536 | Feature search |
| `raw.View=contains:` | `=contains:Lake` | **WORKS** | 1,401 | Feature search |
| `raw.Fencing=contains:` | `=contains:Privacy` | **WORKS** | 5,835 | Feature search |
| `raw.CommunityFeatures=contains:` | `=contains:Pool` | **WORKS** | 8,338 | Feature search |
| `raw.ParkingFeatures=contains:` | `=contains:Garage` | **WORKS** | 13,731 | Feature search |
| `raw.ConstructionMaterials=contains:` | `=contains:Brick` | **WORKS** | 7,038 | Feature search |
| `raw.Roof=contains:` | `=contains:Composition` | **WORKS** | 12,332 | Feature search |
| `raw.Utilities=contains:` | `=contains:Electricity` | **WORKS** | 25,243 | Feature search |
| `raw.Sewer=contains:` | `=contains:Septic` | **WORKS** | 6,544 | Feature search |
| `raw.BathroomsFull=contains:` | `=contains:3` | **WORKS** | 4,378 | Partial match on number |
| `raw.BathroomsHalf=contains:` | `=contains:1` | **WORKS** | 7,627 | Partial match on number |
| `raw.WaterfrontYN=true` | Boolean match | **WORKS** | - | Values are `true`/`false` (not "Yes"/"No") |
| `raw.FireplaceYN=Yes` | Exact match | 0 results | 0 | Field may not exist for this board |
| `raw.HorseYN=true` | Boolean match | **WORKS** | - | Values are `true`/`false` (not "Yes"/"No") |
| `raw.NewConstructionYN=true` | Boolean match | **WORKS** | 3,837 | Values are `true`/`false` (not "Yes"/"No") |
| `raw.SubdivisionName=contains:` | Contains match | **WORKS** | 25 (Shady), 21 (Circle C) | **Use instead of ignored `subdivision` param** |
| `raw.HighSchoolDistrict=` | Exact match | **WORKS** | 6,019 (Austin ISD) | School district filtering works! |
| `raw.Levels` | Array field | Available | - | Values: "One", "Two", "Three Or More", "One and One Half" |
| `raw.GarageYN=Yes` | Exact match | 0 results | 0 | Field may not be populated |
| `raw.Flooring=contains:Hardwood` | Contains match | 0 results | 0 | Field may not be populated for this board |
| `raw.InteriorFeatures=contains:Fireplace` | Contains match | 0 results | 0 | Field may not be populated |
| `raw.ExteriorFeatures=contains:Pool` | Contains match | 0 results | 0 | Field may not be populated |
| Combined raw filters | `raw.PoolFeatures + raw.CountyOrParish` | **WORKS** | 621 | Multiple raw filters AND together correctly |

---

## 3. Listing Fields Available

### Top-Level Keys
```
address, agents, assignment, boardId, class, condominium, coopCompensation,
daysOnMarket, details, imageInsights, images, lastStatus, listDate, listPrice,
lot, map, mlsNumber, nearby, occupancy, office, openHouse, originalPrice,
permissions, photoCount, resource, rooms, simpleDaysOnMarket, soldDate,
soldPrice, standardStatus, status, taxes, timestamps, type, updatedOn
```

### Details Keys
```
HOAFee, HOAFee2, HOAFee3, airConditioning, alternateURLVideoLink, amperage,
analyticsClick, balcony, basement1, basement2, bathrooms, businessSubType,
businessType, ceilingType, centralAirConditioning, centralVac, certificationLevel,
commonElementsIncluded, constructionStatus, constructionStyleSplitLevel, den,
description, driveway, elevator, energuideRating, energyCertification,
exteriorConstruction1, exteriorConstruction2, extras, familyRoom, farmType,
fireProtection, flooringType, foundationType, furnished, garage, 
greenPropertyInformationStatement, handicappedEquipped, heating, landAccessType,
landDisposition, landSewer, landscapeFeatures, laundryLevel, leaseTerms,
liveStreamEventURL, livingAreaMeasurement, loadingType, moreInformationLink,
numBathrooms, numBathroomsHalf, numBathroomsPlus, numBedrooms, numBedroomsPlus,
numDrivewaySpaces, numFireplaces, numGarageSpaces, numKitchens, numKitchensPlus,
numParkingSpaces, numRooms, numRoomsPlus, parkCostMonthly, patio, propertyType,
roofMaterial, sewer, sqft, sqftRange, storageType, style, swimmingPool, viewType,
virtualTourUrl, waterSource, waterfront, yearBuilt, zoning, zoningDescription,
zoningType
```

### Address Keys
```
addressKey, area, city, communityCode, country, district, majorIntersection,
neighborhood, state, streetDirection, streetDirectionPrefix, streetName,
streetNumber, streetSuffix, unitNumber, zip
```

### Map Keys
```
latitude, longitude, point
```

### Lot Keys (from sample listing)
```json
{
  "acres": 8.9479,
  "depth": null,
  "irregular": null,
  "legalDescription": "...",
  "measurement": null,
  "width": null,
  "size": "389770.52",
  "squareFeet": 389770.52,
  "features": "See Remarks",
  "source": null,
  "dimensionsSource": null,
  "dimensions": null,
  "taxLot": null
}
```

---

## 4. Raw (RESO) Fields Available

Full list of raw fields from a sample active listing (173 fields):

```
ACT_AdditionalPetFee, ACT_AdditionalPetFeeDescript, ACT_AddressInternet,
ACT_AdminFeePaybleTo, ACT_AppDeliveryTo, ACT_AppDepositPayableTo,
ACT_AppFeePayableTo, ACT_ApplicationFee, ACT_ApplicationPolicy,
ACT_ApplicationRequired, ACT_CertifiedFundsYN, ACT_ComplexName,
ACT_FEMAFloodPlain, ACT_FirstMonthRentPayableTo, ACT_FlexibleListingYN,
ACT_FloorPlanNameNumber, ACT_HousingVouchersYN, ACT_IDXOptInYN,
ACT_IntermediaryYN, ACT_LastChangeTimestamp, ACT_LastChangeType,
ACT_LaundryLocation, ACT_LeaseGuarantorYN, ACT_ManagedBy,
ACT_ManagementCoPhone, ACT_ManagementCompany, ACT_MaxNumofPets,
ACT_MonthlyPetRent, ACT_MonthlyPetRentPerPetYN, ACT_MoveInSpecialDescription,
ACT_MoveInSpecialYN, ACT_NumDining, ACT_NumLiving, ACT_OnSiteComplianceYN,
ACT_OneTimeExpenses, ACT_OnlineAppInstructions, ACT_OnlineAppInstructionsPublic,
ACT_PerPersonYN, ACT_PerPetYN, ACT_PetDeposit, ACT_PropertyKey,
ACT_PropertyMatch, ACT_RATIO_CurrentPriceLotSizeSquareFeet,
ACT_RATIO_CurrentPrice_By_LivingArea, ACT_RATIO_CurrentPrice_By_OriginalListPrice,
ACT_RATIO_ListPriceLotSizeSquareFeet, ACT_RATIO_ListPrice_By_LivingArea,
ACT_RATIO_ListPrice_By_OriginalListPrice, ACT_RecurringExpenses,
ACT_RentSpreeURL, ACT_RentersInsuranceRequiredYN, ACT_SecurityDeposit,
ACT_SmokingInsideYN, ACT_StatusContractualSearchDate, ACT_TaxFilledSqftTotal,
AccessibilityFeatures, Appliances, AttributionContact, AvailabilityDate,
BathroomsFull, BathroomsHalf, BathroomsTotalInteger, BedroomsTotal,
City, CommunityFeatures, Cooling, Country, CountyOrParish, CoveredSpaces,
CumulativeDaysOnMarket, DaysOnMarket, DirectionFaces, Directions, Disclosures,
ElementarySchool, ExteriorFeatures, Flooring, Furnished, GarageSpaces,
HighSchool, HighSchoolDistrict, HorseYN, InteriorFeatures,
InternetAddressDisplayYN, InternetAutomatedValuationDisplayYN,
InternetConsumerCommentYN, InternetEntireListingDisplayYN, Latitude, LeaseTerm,
Levels, ListAOR, ListAgentAOR, ListAgentDirectPhone, ListAgentEmail,
ListAgentFullName, ListAgentKey, ListAgentMlsId, ListOfficeKey, ListOfficeMlsId,
ListOfficeName, ListOfficePhone, ListPrice, ListingAgreement,
ListingContractDate, ListingId, ListingKey, LivingArea, LivingAreaSource,
LockBoxType, Longitude, LotFeatures, LotSizeAcres, LotSizeSquareFeet,
MLSAreaMajor, MainLevelBedrooms, MajorChangeTimestamp, MajorChangeType,
MiddleOrJuniorSchool, MlgCanUse, MlgCanView, MlsStatus, ModificationTimestamp,
NewConstructionYN, NumberOfUnitsTotal, OccupantType, OriginalEntryTimestamp,
OriginalListPrice, OriginatingSystemName, OwnerName, OwnerPays, ParcelNumber,
ParkingFeatures, ParkingTotal, PetsAllowed, PhotosChangeTimestamp, PhotosCount,
PoolFeatures, PoolPrivateYN, PostalCode, PriceChangeTimestamp, PrivateRemarks,
PropertySubType, PropertyType, PublicRemarks, SecurityFeatures, Sewer,
ShowingContactName, ShowingContactPhone, ShowingContactType, ShowingInstructions,
ShowingRequirements, StandardStatus, StateOrProvince, StatusChangeTimestamp,
StreetDirPrefix, StreetName, StreetNumber, StreetNumberNumeric, StreetSuffix,
SubdivisionName, SyndicateTo, TaxBlock, TaxLegalDescription, TaxMapNumber,
TenantPays, UnitNumber, UnparsedAddress, Utilities, WaterfrontYN, YearBuilt
```

---

## 5. Summary

### Confirmed Working (Native API Parameters)

These parameters are natively supported and return filtered results:

| Parameter | UI Field Mapping | Notes |
|-----------|-----------------|-------|
| `status` | Status checkboxes | A/U/S |
| `type` | Listing Type | sale/lease |
| `minPrice` / `maxPrice` | Price range | Already implemented |
| `minBeds` / `maxBeds` | Bedrooms | Already implemented |
| `minBaths` / `maxBaths` | Total Bathrooms | Already implemented |
| `minSqft` / `maxSqft` | Living Area | Already implemented |
| `city` | City (single value) | Already implemented |
| `zip` | Postal Code (single value) | Already implemented |
| `class` | Property Type class | residential/condo/commercial |
| `neighborhood` | Neighborhood | Already implemented |
| `lat` / `long` / `radius` | Map search | Use instead of bbox! |
| `minYearBuilt` / `maxYearBuilt` | Year Built range | **NEW - wire up** |
| `minGarageSpaces` | Min Garage Spaces | **NEW - wire up** |
| `minStories` | Min Stories/Levels | **NEW - wire up** |
| `minListDate` | List Date filter | **NEW - wire up** |
| `minSoldDate` / `maxSoldDate` | Sold Date filter | Already partially implemented |
| `sortBy` | Sort options | Already implemented |
| `search` / `searchFields` / `fuzzySearch` | Keyword search | Already implemented |

### Confirmed Working (Raw Field Filtering)

The `raw.FieldName=contains:value` and `raw.FieldName=value` syntax works for filtering on RESO raw fields. Multiple raw filters AND together correctly.

| Raw Field | UI Field Mapping | Notes |
|-----------|-----------------|-------|
| `raw.PropertySubType=` | Property Sub Type | Exact match or contains: |
| `raw.PropertySubType=notContains:` | Exclude property types | Exclusion works |
| `raw.CountyOrParish=` | County | Exact match |
| `raw.ElementarySchool=contains:` | Elementary School | **Wire up** |
| `raw.HighSchool=contains:` | High School | **Wire up** |
| `raw.MiddleOrJuniorSchool=contains:` | Middle School | **Wire up** |
| `raw.HighSchoolDistrict=` | School District | Field exists, test exact match |
| `raw.PoolFeatures=contains:` | Pool features | **Wire up** |
| `raw.CommunityFeatures=contains:` | Community Features | **Wire up** |
| `raw.ParkingFeatures=contains:` | Parking Features | **Wire up** |
| `raw.Appliances=contains:` | Appliances | Available if UI added |
| `raw.Heating=contains:` | Heating | Available if UI added |
| `raw.Cooling=contains:` | Cooling/AC | Available if UI added |
| `raw.Utilities=contains:` | Utilities | **Wire up** |
| `raw.Sewer=contains:` | Sewer | **Wire up** |
| `raw.ConstructionMaterials=contains:` | Construction | Available if UI added |
| `raw.Roof=contains:` | Roof | Available if UI added |
| `raw.View=contains:` | View type | Available if UI added |
| `raw.Fencing=contains:` | Fencing | Available if UI added |
| `raw.BathroomsFull=contains:` | Full Bathrooms | Caveat: partial string match on numbers |
| `raw.BathroomsHalf=contains:` | Half Bathrooms | Caveat: partial string match on numbers |
| `raw.GarageSpaces=contains:` | Garage Spaces | Caveat: partial string match |
| `raw.AssociationFee=contains:` | HOA Fee | Contains match, not range filter |
| `raw.SubdivisionName=` | Subdivision | **Wire up as alternative to ignored `subdivision` param** |
| `raw.LotFeatures=contains:` | Lot Features | Available if UI added |

### Not Supported (Confirmed Ignored or Not Available)

| Parameter | Status | Notes |
|-----------|--------|-------|
| `subdivision` | **IGNORED** | Use `raw.SubdivisionName=` instead |
| `county` | **IGNORED** | Use `raw.CountyOrParish=` instead |
| `schoolDistrict` | **IGNORED** | Use `raw.HighSchoolDistrict=` instead |
| `minLotSize` / `maxLotSize` | **IGNORED** | No lot size range filtering available |
| `minLotSizeAcres` | **IGNORED** | No lot acreage range filtering |
| `minLotFrontage` | **IGNORED** | Not supported |
| `maxHoaFee` / `hoaFee` | **IGNORED** | No HOA fee range filtering |
| `pool` / `hasPool` | **IGNORED** | Use `raw.PoolFeatures=contains:` |
| `waterfront` | **IGNORED** | `raw.WaterfrontYN` exists but returns 0 (may not be populated) |
| `newConstruction` | **IGNORED** | `raw.NewConstructionYN` exists but returns 0 |
| `gatedCommunity` | **IGNORED** | No direct parameter; try `raw.CommunityFeatures=contains:Gated` |
| `garage=true` | Not supported | Use `minGarageSpaces` instead |
| `stories=N` | **IGNORED** | Use `minStories` instead |
| `maxDaysOnMarket` | **ERROR** | Returns array instead of standard response |
| `minDaysOnMarket` | **ERROR** | Returns array instead of standard response |
| `minLat/maxLat/minLng/maxLng` | **IGNORED** | Use `lat/long/radius` instead |
| Multi-value `city` (comma/pipe/JSON) | 0 results | Only single city per query supported |
| Multi-value `zip` (comma/pipe) | 0 results | Only single zip per query supported |
| `not:` prefix on standard fields | **IGNORED** | Only works on raw fields |
| `contains:` prefix on standard fields | **IGNORED** | Only works on raw fields |
| `operator=or` / `operator=or:field` | No effect | Doesn't enable multi-value |

### Needs Alternative Approach

| UI Feature | Issue | Recommended Workaround |
|-----------|-------|----------------------|
| **Multi-city search** | API only accepts single city | Run parallel queries per city and merge results; OR use `lat/long/radius` for geographic area |
| **Multi-zip search** | API only accepts single zip | Run parallel queries per zip and merge results |
| **Lot size filtering** | `minLotSize`/`maxLotSize` ignored | Server-side filter using `lot.squareFeet` or `lot.acres` from response data |
| **HOA fee range** | `maxHoaFee` ignored | Server-side filter using `details.HOAFee` from response data |
| **Days on market** | `maxDaysOnMarket` returns error | Server-side filter using `daysOnMarket` or `simpleDaysOnMarket` from response |
| **Subdivision filter** | `subdivision` param ignored | Use `raw.SubdivisionName=contains:value` or exact match |
| **County filter** | `county` param ignored | Use `raw.CountyOrParish=value` (exact match works) |
| **School District** | `schoolDistrict` ignored | Use `raw.HighSchoolDistrict=value` (field exists, needs testing) |
| **Waterfront** | `raw.WaterfrontYN` uses `true`/`false` not "Yes" | Use `raw.WaterfrontYN=true` (confirmed field exists with boolean values) |
| **New Construction** | `raw.NewConstructionYN` uses `true`/`false` not "Yes" | Use `raw.NewConstructionYN=true` (**WORKS** - 3,837 results) |
| **Horse property** | `raw.HorseYN` uses `true`/`false` not "Yes" | Use `raw.HorseYN=true` (confirmed field exists with boolean values) |
| **Fireplace** | `raw.FireplaceYN` returns 0 | Field may not exist for this board; no reliable workaround |
| **Interior/Exterior features** | `raw.InteriorFeatures` / `raw.ExteriorFeatures` return 0 | Fields not populated for this MLS board (ACTRIS); cannot filter |
| **Flooring** | `raw.Flooring=contains:Hardwood` returns 0 | Field not populated for this board |
| **Map bounding box** | `minLat/maxLat/minLng/maxLng` ignored | Use `lat/long/radius` instead (confirmed working) |
| **Full/Half baths separate** | `raw.BathroomsFull=contains:3` works but partial match | Number "3" also matches "13", "30", etc. Consider server-side post-filtering for exact counts |
| **Subdivision** | `subdivision` param ignored | Use `raw.SubdivisionName=contains:value` (**WORKS** - confirmed) |
| **School District** | `schoolDistrict` param ignored | Use `raw.HighSchoolDistrict=value` (**WORKS** - 6,019 for Austin ISD) |
| **County** | `county` param ignored | Use `raw.CountyOrParish=value` (**WORKS** - 11,778 for Travis) |
| **Stories/Levels** | `raw.Levels` is an array field | Values: "One", "Two", "Three Or More", "One and One Half"; use `raw.Levels=contains:Two` |

---

## 6. Key Architectural Findings

### Bounding Box vs Radius
The current codebase uses `minLat/maxLat/minLng/maxLng` for geocoded address searches, but these are **IGNORED** by the API. The codebase should switch to `lat/long/radius` which is confirmed working.

### Raw Field Filtering is the Primary Mechanism
Most advanced filtering must go through `raw.FieldName=contains:value` syntax. This is the most powerful and reliable way to filter on RESO data dictionary fields. Multiple raw field filters AND together correctly.

### Multi-Value Limitation
The API does not support multiple values for `city` or `zip` in any format (comma, pipe, JSON array). For multi-value location searching, the application must either:
1. Make parallel API calls and merge/deduplicate results
2. Use geographic radius search as an alternative

### Server-Side Filtering Still Needed For
- Lot size ranges (sqft or acres)
- HOA fee ranges  
- Days on market ranges
- Exact numeric matching on bathroom counts (to avoid partial string matching)
- Any YN boolean fields that return 0 (not populated for this board)
