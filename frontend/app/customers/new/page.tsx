import { CustomerForm } from '@/components/customers/CustomerForm';

export default function AddCustomerPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5f8fd_0%,#eef4fb_100%)] px-3 py-4 sm:px-5 sm:py-6 lg:px-7">
      <CustomerForm />
    </main>
  );
}
