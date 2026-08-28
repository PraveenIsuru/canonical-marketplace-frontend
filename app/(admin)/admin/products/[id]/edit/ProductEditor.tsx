'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteProductImage,
  editAdminProduct,
  editFieldError,
  getAdminProduct,
} from '@/lib/api/admin-products';
import { isForbidden } from '@/lib/api/admin-proposals';
import { queryKeys } from '@/lib/query/keys';
import { Alert, Button, Card, Dialog, Input, Skeleton } from '@/components/ui';
import { SpecificationEditor } from '@/components/admin/SpecificationEditor';
import { AttributeWidener } from '@/components/admin/AttributeWidener';
import type { AdminProductDetail, AdminProductEdit } from '@/types/admin';

/**
 * S-35 Editing a record directly.
 *
 * The one path into product data that is not a proposal, and it exists because some
 * corrections have nobody to propose them: a product no seller carries has no reviewer
 * set at all.
 *
 * **Four things this screen deliberately does not offer**, and none of them is a
 * disabled control, because a greyed out button implies the capability exists and is
 * merely unavailable:
 *
 *  - **No slug edit.** It is the record's public address and a rename breaks every link.
 *  - **No variant removal, and no variants array of any kind.** Invariant 2: a
 *    generated combination is never removed, by anyone, an administrator included.
 *  - **No new attribute.** The API refuses it, because adding a dimension would leave
 *    every existing combination without a value for it, permanently. The screen says so
 *    rather than offering a control that always fails.
 *  - **No rollback.** History is read only, per section 2.3 of the build plan.
 *
 * Saving writes an **administrator originated version**. The acting administrator is
 * recorded server side and named to nobody, here or on any seller facing screen.
 */
export function ProductEditor({ id }: { id: number }) {
  const queryClient = useQueryClient();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.admin.product(id),
    queryFn: () => getAdminProduct(id),
    retry: false,
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <Breadcrumb />
        {isForbidden(error) ? (
          <Alert tone="error" title="This is an administrator screen">
            Your account is not an administrator.
          </Alert>
        ) : (
          <Alert tone="error" title="This product could not be loaded">
            <button type="button" onClick={() => refetch()} className="underline">
              Try again
            </button>
          </Alert>
        )}
      </div>
    );
  }

  return <EditForm product={data} onSaved={() => queryClient.invalidateQueries({ queryKey: queryKeys.admin.product(id) })} />;
}

function EditForm({
  product,
  onSaved,
}: {
  product: AdminProductDetail;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? '');
  const [category, setCategory] = useState(product.category);
  const [specifications, setSpecifications] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(product.specifications).map(([key, value]) => [key, String(value)]),
    ),
  );
  const [added, setAdded] = useState<Record<string, string[]>>({});
  const [savedVersion, setSavedVersion] = useState<number | null>(null);

  const save = useMutation({
    mutationFn: (changes: AdminProductEdit) => editAdminProduct(product.id, changes),
    onSuccess: (updated) => {
      setSavedVersion(updated.current_version_number);
      setAdded({});
      onSaved();
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.products() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(product.slug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.versions(product.slug) });
    },
  });

  const attributesToSend = Object.entries(added)
    .filter(([, options]) => options.length > 0)
    .map(([attributeName, options]) => {
      const existing = product.attributes.find((attribute) => attribute.name === attributeName);
      // Sent as the full widened list. The API merges by name and never narrows, so
      // including the existing options is harmless and makes the request self describing.
      return { name: attributeName, options: [...(existing?.options ?? []), ...options] };
    });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setSavedVersion(null);

    save.mutate({
      name,
      description: description.trim() === '' ? null : description,
      category,
      // Replaces the map wholesale, which is how a key gets removed. The editor below
      // is built around that rather than treating it as a patch.
      specifications,
      ...(attributesToSend.length > 0 ? { attributes: attributesToSend } : {}),
    });
  }

  const newCombinations = countNewCombinations(product, added);

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 py-8">
      <Breadcrumb />

      <div>
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Editing the shared record directly. Every seller carrying this product sees the
          result.
        </p>
      </div>

      {/*
        Pending and escalated both set this flag. The edit is allowed either way, and
        saying what happens next is more useful than blocking it: making an
        administrator wait three days for a peer review before fixing an obvious error
        would be the wrong trade.
      */}
      {product.has_pending_proposal && (
        <Alert tone="warning" title="A seller is blocked on this record">
          <p>
            A proposal against this product is still unresolved. Editing here is allowed
            and does not disturb it.
          </p>
          <p className="mt-2">
            If that proposal is later accepted it writes its own version{' '}
            <strong className="font-medium">above</strong> whatever you save now, and
            applies the values it recorded. The two do not merge.
          </p>
          <p className="mt-2">
            <Link href="/admin/escalations" className="underline">
              Escalations
            </Link>
          </p>
        </Alert>
      )}

      {savedVersion !== null && (
        <Alert tone="success" title="Saved">
          <p>
            Written as version {savedVersion}, marked as an administrator edit. The
            previous version is still in the chain: nothing was replaced.
          </p>
          <p className="mt-2">
            <Link href={`/versions/${product.slug}`} className="underline">
              Record history
            </Link>
          </p>
        </Alert>
      )}

      {save.isError && !editFieldError(save.error, 'attributes') && (
        <Alert tone="error" title="The record could not be saved">
          Nothing has changed. Check the fields and try again.
        </Alert>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Details</h2>

        <Input
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={editFieldError(save.error, 'name')}
        />

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <Input
          label="Category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          error={editFieldError(save.error, 'category')}
        />

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          The address <code>/products/{product.slug}</code> cannot be changed. Every link
          and every prerendered page is keyed by it.
        </p>
      </section>

      <SpecificationEditor value={specifications} onChange={setSpecifications} />

      <AttributeWidener
        attributes={product.attributes}
        added={added}
        onChange={setAdded}
        newCombinations={newCombinations}
        existingCombinations={product.variants.length}
        error={editFieldError(save.error, 'attributes')}
      />

      <CombinationList product={product} />

      <ImageList product={product} />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={save.isPending}>
          Save and write a version
        </Button>
        <Link href={`/versions/${product.slug}`} className="text-sm underline">
          Record history
        </Link>
      </div>

      <Card className="text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          Saving writes a new version marked as an administrator edit. Versions are never
          removed or replaced, so there is no undo: a further correction goes forward as
          another version.
        </p>
      </Card>
    </form>
  );
}

/**
 * How many combinations the pending option additions would generate.
 *
 * The cross product of every option list after widening, minus what exists now.
 * Computed here rather than asked of the API, because it is arithmetic on data already
 * in hand and an administrator deciding whether to add an option should see the cost
 * before committing rather than after.
 */
function countNewCombinations(
  product: AdminProductDetail,
  added: Record<string, string[]>,
): number {
  if (product.attributes.length === 0) return 0;

  const total = product.attributes.reduce((running, attribute) => {
    const extra = (added[attribute.name] ?? []).length;
    return running * (attribute.options.length + extra);
  }, 1);

  return Math.max(0, total - product.variants.length);
}

/**
 * Every generated combination, including the ones nobody carries.
 *
 * Read only, and there is no control here of any kind. Invariant 2: a combination is
 * never removed, by anyone. Listing them with a delete beside each would be the first
 * step towards breaking that, and hiding the empty ones would be the first place
 * somebody got the idea it was possible.
 */
function CombinationList({ product }: { product: AdminProductDetail }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">
        Combinations
        <span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
          {product.variants.length}
        </span>
      </h2>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Generated from the attribute options. Permanent: none of these can be removed,
        including by an administrator. One nobody carries simply shows no sellers.
      </p>

      <ul className="flex flex-wrap gap-2">
        {product.variants.map((variant) => {
          const values = Object.values(variant.attribute_values);

          return (
            <li
              key={variant.id}
              className="rounded-md border border-zinc-200 px-2.5 py-1 text-sm dark:border-zinc-800"
            >
              {values.length > 0 ? values.join(', ') : 'The only combination'}
              <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                {variant.seller_count === 0
                  ? 'no sellers'
                  : `${variant.seller_count} ${variant.seller_count === 1 ? 'seller' : 'sellers'}`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Images on the record, with the only deletion path any image has.
 *
 * A seller may add an image through the upload endpoint and may never remove one,
 * because an uploader who could remove an image could remove one a later seller relies
 * on. Unlike a community post this is a real deletion, row and file, and there is
 * nothing to restore afterwards, which is what the confirmation says.
 */
function ImageList({ product }: { product: AdminProductDetail }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<number | null>(null);

  const remove = useMutation({
    mutationFn: (imageId: number) => deleteProductImage(product.slug, imageId),
    onSuccess: () => {
      setConfirming(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.product(product.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(product.slug) });
    },
  });

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Images</h2>

      {product.images.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This record has no images. Sellers add them; only an administrator can remove
          one.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {product.images.map((image) => (
            <li key={image.id} className="flex flex-col items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt=""
                className="h-24 w-24 rounded-md border border-zinc-200 object-cover dark:border-zinc-800"
              />
              <button
                type="button"
                onClick={() => setConfirming(image.id)}
                className="text-xs text-red-700 underline dark:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {remove.isError && (
        <Alert tone="error" title="The image could not be removed">
          Nothing has changed.
        </Alert>
      )}

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Remove this image?"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={remove.isPending}
              onClick={() => confirming !== null && remove.mutate(confirming)}
            >
              Remove
            </Button>
          </>
        }
      >
        <p>
          The file is deleted along with the record of it. This cannot be undone and
          there is no way to restore it.
        </p>
        <p className="mt-2">
          Images belong to the shared record, so every seller carrying this product loses
          it too.
        </p>
      </Dialog>
    </section>
  );
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-zinc-500 dark:text-zinc-400">
      <Link href="/admin/products" className="underline">
        Products
      </Link>
    </nav>
  );
}
