'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isStoreExists, registerStore } from '@/lib/api/stores';
import { ApiError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/useSession';
import { queryKeys } from '@/lib/query/keys';
import { Alert, Button, Input, Skeleton } from '@/components/ui';

/**
 * S-17 Store registration.
 *
 * The screen that turns a buyer into a seller. Its one subtlety is what happens when
 * the address cannot be geocoded, which is not an error.
 */
export function StoreRegistrationForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, isLoading } = useSession();

  const [form, setForm] = useState({
    name: '',
    category: '',
    contact_email: '',
    contact_phone: '',
    address_line: '',
    city: '',
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  function update(field: keyof typeof form) {
    return (event: { target: { value: string } }) =>
      setForm((previous) => ({ ...previous, [field]: event.target.value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const store = await registerStore({
        ...form,
        contact_phone: form.contact_phone.trim() === '' ? null : form.contact_phone,
      });

      /*
       * The session now carries a store, which is the whole definition of the seller
       * role. Invalidating it is what makes the seller navigation appear without a
       * reload.
       */
      await queryClient.invalidateQueries({ queryKey: queryKeys.user.current() });

      /*
       * A failed geocode is **not** a failed registration.
       *
       * The store exists, the details were kept, and the only thing missing is a
       * location. So this is a redirect to the next step, not an error to report: the
       * pin screen explains it in its own words, and nothing here is styled as a
       * failure.
       */
      router.push(store.geocoding_failed ? '/sell/pin' : '/dashboard');
      router.refresh();
    } catch (caught) {
      if (isStoreExists(caught)) {
        // Already a seller. Their settings are what they actually wanted.
        router.push('/store/settings');
        return;
      }

      setError(caught instanceof ApiError ? caught : new ApiError(0, 'unknown', 'Registration failed.'));
      setPending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Already holds a store, so this screen has nothing to offer them.
  if (session?.store) {
    return (
      <div className="flex flex-col gap-4 py-8">
        <h1 className="text-2xl font-semibold">You already have a store</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          One account holds one store. You can change its details at any time.
        </p>
        <div className="flex gap-4 text-sm">
          <Link href="/store/settings" className="underline">
            Store settings
          </Link>
          <Link href="/dashboard" className="underline">
            Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Start selling</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Register your store once. You then attach it to products buyers are already
          looking at, rather than writing your own listings.
        </p>
      </div>

      {error && !error.isValidationError && <Alert tone="error">{error.message}</Alert>}

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Business name"
          name="name"
          required
          value={form.name}
          onChange={update('name')}
          error={error?.fieldError('name')}
        />

        <Input
          label="Store category"
          name="category"
          required
          value={form.category}
          onChange={update('category')}
          hint="For example Electronics, Home, or Mobile."
          error={error?.fieldError('category')}
        />

        <Input
          label="Contact email"
          type="email"
          name="contact_email"
          required
          value={form.contact_email}
          onChange={update('contact_email')}
          hint="Shown publicly. Buyers contact you directly."
          error={error?.fieldError('contact_email')}
        />

        <Input
          label="Contact phone"
          name="contact_phone"
          value={form.contact_phone}
          onChange={update('contact_phone')}
          hint="Optional, and also shown publicly."
          error={error?.fieldError('contact_phone')}
        />

        <Input
          label="Address"
          name="address_line"
          required
          value={form.address_line}
          onChange={update('address_line')}
          error={error?.fieldError('address_line')}
        />

        <Input
          label="City"
          name="city"
          required
          value={form.city}
          onChange={update('city')}
          hint="Used to find your location on the map. You can place it by hand if we cannot."
          error={error?.fieldError('city')}
        />

        <Button type="submit" loading={pending}>
          Register store
        </Button>
      </form>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Your address and contact details are public. That is how buyers reach you: the
        platform lists sellers and hands the buyer over, it does not process orders.
      </p>
    </div>
  );
}
