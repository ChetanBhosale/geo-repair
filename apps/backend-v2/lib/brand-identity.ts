type ScanBrand = {
  name?: string | null;
  faviconUrl?: string | null;
  logoUrl?: string | null;
};

type ScanWithBrand = {
  brand?: ScanBrand | null;
};

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export function projectBrandDataFromScan(result: ScanWithBrand) {
  const brand = result.brand;
  if (!brand) return null;

  const data = {
    brandName: clean(brand.name),
    faviconUrl: clean(brand.faviconUrl),
    logoUrl: clean(brand.logoUrl),
    brandUpdatedAt: new Date(),
  };

  if (!data.brandName && !data.faviconUrl && !data.logoUrl) return null;
  return data;
}
