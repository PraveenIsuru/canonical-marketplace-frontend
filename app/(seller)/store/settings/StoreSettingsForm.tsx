'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyStore, needsPinPlacement, updateMyStore } from '@/lib/api/stores';
import { ApiError } from '@/lib/api/client';
import { queryKeys } from '@/lib/query/keys';
import { Alert, Button, Card, Input, Skeleton } from '@/components/ui';
import type { OwnStore } from '@/lib/schemas/catalogue';

/**
 * S-19 Store settings.
 *
 * Prefilled from EP-54, which is why that endpoint exists: the session carries only a
 * minimal store object, and a form cannot be built from an id and a name.
 *
 * There is no control to add a second location. One store holds exactly one physical
 * location, and editing details never changes visibility.
 */
export function StoreSettingsForm() {
  const queryClient = useQueryClient();

  const { data: store, isPending, isError, refetch } = useQuery({
    queryKey: queryKeys.stores.mine(),
    queryFn: getMyStore,
  });

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (isError || !store) {
    return (
      <div className="py-8">
        <Alert tone="error" title="Your store could not be loaded">
          <button type="button" onClick={() => refetch()} className="underline">
            Try again
          </button>
        </Alert>
      </div>
    );
  }

  return <Loaded store={store} queryClient={queryClient} />;
}

function Loaded({
  store,
  queryClient,
}: {
  store: OwnStore;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [form, setForm] = useState({
    name: store.name,
    category: store.category,
    contact_email: store.contact_email,
    contact_phone: store.contact_phone ?? '',
    address_line: store.address_line,
    city: store.city,
  });
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      updateMyStore({
        ...form,
        contact_phone: form.contact_phone.trim() === '' ? null : form.contact_phone,
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.stores.mine(), updated);
      // The name may have changed, and the navigation shows it.
      await queryClient.invalidateQueries({ queryKey: queryKeys.user.current() });
      setSaved(true);
    },
  });

  function update(field: keyof typeof form) {
    return (event: { target: { value: string } }) => {
      setSaved(false);
      setForm((previous) => ({ ...previous, [field]: event.target.value }));
    };
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  const error = save.error instanceof ApiError ? save.error : null;
  const result = save.data;

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Store settings</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Your address and contact details are shown publicly to buyers.
        </p>
      </div>

      {/*
        A failed re-geocode is not a failed save.

        The other fields were stored and the previous coordinates were kept, so the
        store is no worse off than before. All that is needed is a pin, which is why
        this is informational and offers a route rather than reporting an error.
      */}
      {result?.geocoding_failed && (
        <Alert tone="warning" title="Saved, but we could not find the new address">
          Your details were updated and your previous location is unchanged. To move the
          store on the map,{' '}
          <Link href="/sell/pin" className="underline">
            place the pin by hand
          </Link>
          .
        </Alert>
      )}

      {saved && !result?.geocoding_failed && <Alert tone="success">Store details saved.</Alert>}

      {error && !error.isValidationError && <Alert tone="error">{error.message}</Alert>}

      {needsPinPlacement(store) && (
        <Alert tone="warning" title="Your location is not set">
          <Link href="/sell/pin" className="underline">
            Place your pin
          </Link>{' '}
          so buyers can find you.
        </Alert>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Business name"
          value={form.name}
          onChange={update('name')}
          error={error?.fieldError('name')}
        />
        <Input
          label="Store category"
          value={form.category}
          onChange={update('category')}
          error={error?.fieldError('category')}
        />
        <Input
          label="Contact email"
          type="email"
          value={form.contact_email}
          onChange={update('contact_email')}
          error={error?.fieldError('contact_email')}
        />
        <Input
          label="Contact phone"
          value={form.contact_phone}
          onChange={update('contact_phone')}
          hint="Optional."
          error={error?.fieldError('contact_phone')}
        />
        <Input
          label="Address"
          value={form.address_line}
          onChange={update('address_line')}
          hint="Changing the address or city re-checks your position on the map."
          error={error?.fieldError('address_line')}
        />
        <Input
          label="City"
          value={form.city}
          onChange={update('city')}
          error={error?.fieldError('city')}
        />

        <Button type="submit" loading={save.isPending}>
          Save changes
        </Button>
      </form>

      <Card className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            Editing details never changes whether buyers can see you.
          </span>{' '}
          Visibility depends only on carrying at least one product.
        </p>
        <p>
          One store holds one physical location. There is no way to add a second, and
          nothing here can delete the store.
        </p>
      </Card>
    </div>
  );
}
