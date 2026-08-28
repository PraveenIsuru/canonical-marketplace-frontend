import type { ProductDetail, PublicStore, SellerListing } from '@/lib/schemas/catalogue';

/**
 * The JSON-LD a crawler reads instead of guessing at the markup.
 *
 * Moved out of the product page at M12 so the two public schemas live together and can
 * be checked against each other, which is where the build plan's directory layout puts
 * structured data.
 *
 * ## The rule everything here follows
 *
 * **Nothing is emitted that the page does not also show a person.** Structured data
 * that describes something the visitor cannot see is misrepresentation whether or not
 * it was meant as one, and search engines treat it as exactly that. So there is no
 * invented rating, no availability claimed for a product nobody stocks, and no field
 * padded out to make the block look more complete.
 *
 * That rule is also what keeps section 6 of the contract safe here. A confidence score,
 * a verification photograph path, and a product creator are not on the page, are not on
 * the wire, and so cannot reach this file to be leaked into a script tag, which would be
 * a particularly quiet way to publish them.
 */

/** Minor units to major, for schema.org, which wants a decimal price. */
function toMajor(minor: number): number {
  return minor / 100;
}

/**
 * Product schema for the canonical record.
 *
 * The offers block is omitted where no seller is attached. Such products stay visible
 * in the catalogue by design, and emitting an empty aggregate would tell a crawler the
 * product is purchasable at an unspecified price rather than that nobody carries it.
 */
export function ProductStructuredData({
  product,
  sellers,
  url,
}: {
  product: ProductDetail;
  sellers: SellerListing[];
  url: string;
}) {
  const prices = sellers.map((listing) => listing.price_minor);

  /*
   * Specifications become additionalProperty rather than being flattened into the
   * description. They are rendered as a definition list on the page, so this is the
   * same information in the shape a crawler can actually read, and it is the part of a
   * canonical record that makes one product distinguishable from another.
   */
  const specifications = Object.entries(product.specifications).map(([name, value]) => ({
    '@type': 'PropertyValue',
    name,
    value: String(value),
  }));

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': url,
    name: product.name,
    description: product.description ?? undefined,
    category: product.category,
    image: product.images.map((image) => image.url),
    additionalProperty: specifications.length > 0 ? specifications : undefined,
    offers:
      prices.length > 0
        ? {
            '@type': 'AggregateOffer',
            offerCount: sellers.length,
            lowPrice: toMajor(Math.min(...prices)),
            highPrice: toMajor(Math.max(...prices)),
            priceCurrency: sellers[0]?.currency,
            /*
             * Availability is read off the listings rather than assumed. A product every
             * seller has marked unavailable is out of stock, and saying otherwise sends
             * somebody to a shop that cannot serve them.
             */
            availability: sellers.some((listing) => listing.is_available)
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          }
        : undefined,
  };

  return <JsonLd schema={schema} />;
}

/**
 * Store schema for a seller's public profile.
 *
 * `aggregateRating` is emitted only where a rating exists. A store nobody has rated
 * gets no rating block at all, rather than a zero, which would read as a bad review
 * rather than as an absence of reviews.
 */
export function StoreStructuredData({ store, url }: { store: PublicStore; url: string }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': url,
    name: store.name,
    email: store.contact_email,
    telephone: store.contact_phone ?? undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: store.address_line,
      addressLocality: store.city,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: store.latitude,
      longitude: store.longitude,
    },
    aggregateRating:
      store.rating === null
        ? undefined
        : {
            '@type': 'AggregateRating',
            ratingValue: store.rating,
            bestRating: 5,
          },
  };

  return <JsonLd schema={schema} />;
}

/**
 * The script tag itself.
 *
 * `JSON.stringify` drops keys whose value is undefined, which is what every optional
 * field above relies on: an absent rating disappears rather than serialising as null,
 * and null in JSON-LD is a claim that the value is empty rather than unknown.
 *
 * `dangerouslySetInnerHTML` is unavoidable for JSON-LD, since React would otherwise
 * escape the JSON into something no parser will read. What goes in is the output of
 * `JSON.stringify`, so the only characters that could close the tag early are escaped
 * by it, and `<` is replaced below for the one case it does not cover.
 */
function JsonLd({ schema }: { schema: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
    />
  );
}
