import type { Route } from "next";
import Link from "next/link";
import {
  createAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  updateAddressAction
} from "@/app/actions/commerce";
import { EmptyState } from "@/components/storefront/emptyState";
import { getAddresses } from "@/lib/commerceApi";
import { getDemoSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AddressesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getDemoSession();
  const addresses = await getAddresses();
  const resolvedSearchParams = (await searchParams) ?? {};
  const flashMessage = getFlashMessage(readQueryParam(resolvedSearchParams.status));

  if (!session) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <EmptyState
          title="Login to manage addresses"
          description="Use the buyer demo login first, then reopen your address book."
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {flashMessage ? (
          <div className="mb-6 rounded-[1.5rem] border border-orange-200 bg-orange-50 px-5 py-4 text-sm text-slate-700">
            {flashMessage}
          </div>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-500">
              Account
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Saved addresses</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Keep multiple shipping destinations and pick one as the default checkout address.
            </p>
          </div>
          <Link
            href={"/checkout" as Route}
            className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
          >
            Back to checkout
          </Link>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[420px_1fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-950">Add new address</h2>
            <form action={createAddressAction} className="mt-5 space-y-4">
              <AddressFields />
              <label className="flex items-center gap-3 text-sm text-slate-600">
                <input type="checkbox" name="isDefault" value="true" />
                Set as default address
              </label>
              <button
                type="submit"
                className="rounded-full bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
              >
                Save address
              </button>
            </form>
          </section>

          <section className="space-y-5">
            {addresses.length > 0 ? (
              addresses.map((address) => (
                <div
                  key={address.id}
                  className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-950">{address.label}</h2>
                        {address.isDefault ? (
                          <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
                            Default
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {address.recipientName} • {address.phoneNumber}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {[
                          address.addressLine1,
                          address.addressLine2,
                          address.ward,
                          address.district,
                          address.province
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!address.isDefault ? (
                        <form action={setDefaultAddressAction}>
                          <input type="hidden" name="addressId" value={address.id} />
                          <button
                            type="submit"
                            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                          >
                            Set default
                          </button>
                        </form>
                      ) : null}
                      <Link
                        href={`/checkout?addressId=${address.id}` as Route}
                        className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Use in checkout
                      </Link>
                      <form action={deleteAddressAction}>
                        <input type="hidden" name="addressId" value={address.id} />
                        <button
                          type="submit"
                          className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>

                  <form action={updateAddressAction} className="mt-5 space-y-4">
                    <input type="hidden" name="addressId" value={address.id} />
                    <AddressFields address={address} />
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                      >
                        Update address
                      </button>
                      {!address.isDefault ? (
                        <label className="flex items-center gap-3 text-sm text-slate-600">
                          <input type="checkbox" name="isDefault" value="true" />
                          Make default on update
                        </label>
                      ) : null}
                    </div>
                  </form>
                </div>
              ))
            ) : (
              <EmptyState
                title="No saved addresses yet"
                description="Create your first address and it will become the default for checkout."
              />
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function AddressFields({
  address
}: {
  address?: {
    label: string;
    recipientName: string;
    phoneNumber: string;
    addressLine1: string;
    addressLine2: string | null;
    ward: string | null;
    district: string;
    province: string;
    regionCode: string;
  };
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <input
        name="label"
        defaultValue={address?.label ?? ""}
        placeholder="Home / Office / Parents"
        className={inputClass}
      />
      <input
        name="recipientName"
        defaultValue={address?.recipientName ?? ""}
        placeholder="Recipient name"
        className={inputClass}
      />
      <input
        name="phoneNumber"
        defaultValue={address?.phoneNumber ?? ""}
        placeholder="Phone number"
        className={inputClass}
      />
      <select name="regionCode" defaultValue={address?.regionCode ?? "HCM"} className={inputClass}>
        <option value="HCM">Ho Chi Minh City</option>
        <option value="HN">Ha Noi</option>
        <option value="CENTRAL">Central</option>
        <option value="OTHER">Other province</option>
      </select>
      <input
        name="addressLine1"
        defaultValue={address?.addressLine1 ?? ""}
        placeholder="Address line 1"
        className={`${inputClass} sm:col-span-2`}
      />
      <input
        name="addressLine2"
        defaultValue={address?.addressLine2 ?? ""}
        placeholder="Address line 2 (optional)"
        className={inputClass}
      />
      <input
        name="ward"
        defaultValue={address?.ward ?? ""}
        placeholder="Ward (optional)"
        className={inputClass}
      />
      <input
        name="district"
        defaultValue={address?.district ?? ""}
        placeholder="District"
        className={inputClass}
      />
      <input
        name="province"
        defaultValue={address?.province ?? ""}
        placeholder="Province / city"
        className={inputClass}
      />
    </div>
  );
}

const inputClass =
  "rounded-full border border-slate-200 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400";

function readQueryParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getFlashMessage(status?: string) {
  switch (status) {
    case "created":
      return "Address saved.";
    case "updated":
      return "Address updated.";
    case "default":
      return "Default address updated.";
    case "deleted":
      return "Address deleted.";
    default:
      return null;
  }
}
