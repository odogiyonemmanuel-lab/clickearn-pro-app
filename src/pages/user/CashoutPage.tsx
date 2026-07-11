import { useState, type FormEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import toast from "react-hot-toast";
import {
  Wallet, Banknote, ArrowDownToLine, Clock, CheckCircle2, XCircle,
  Building2, CreditCard, User, Info, Loader2,
} from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useSettings } from "../../hooks/useSettings";
import { formatCurrency, formatDate, cn } from "../../lib/utils";
import EmptyState from "../../components/ui/EmptyState";
import Badge from "../../components/ui/Badge";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type WalletDoc = {
  _id: string;
  available: number;
  pending: number;
  totalEarned: number;
  totalWithdrawn: number;
};

type CashoutDoc = {
  _id: string;
  amount: number;
  accountName: string;
  accountNumber: string;
  bankName: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  processedAt?: number;
  createdAt: number;
};

type CashoutPageResult = {
  page: CashoutDoc[];
  isDone: boolean;
  continueCursor: string;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const statusVariant: Record<
  CashoutDoc["status"],
  "warning" | "success" | "error"
> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
};

const statusIcon: Record<CashoutDoc["status"], typeof Clock> = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

function CashoutSkeleton() {
  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="skeleton mb-4 h-6 w-40" />
        <div className="skeleton h-24 w-full rounded-xl" />
      </div>
      <div className="card p-6">
        <div className="skeleton mb-6 h-6 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="skeleton mb-2 h-4 w-24" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function CashoutPage() {
  const wallet = useQuery(api.users.getMyWallet as any) as
    | WalletDoc
    | undefined;
  const cashoutsResult = useQuery(api.cashouts.getMyCashouts as any, {
    paginationOpts: { numItems: 20, cursor: null },
  }) as CashoutPageResult | undefined;
  const requestCashout = useMutation(api.cashouts.requestCashout as any);
  const { minCashout, paymentProvider, paymentAccountName, paymentAccountNumber } =
    useSettings();

  const [amount, setAmount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const available = wallet?.available ?? 0;
  const cashouts = cashoutsResult?.page ?? [];
  const isLoading = wallet === undefined || cashoutsResult === undefined;

  /* ---------- Validation ---------- */
  const numericAmount = parseFloat(amount) || 0;
  const tooLow = numericAmount > 0 && numericAmount < minCashout;
  const tooHigh = numericAmount > available;
  const formInvalid =
    !accountName.trim() ||
    !accountNumber.trim() ||
    !bankName.trim() ||
    numericAmount <= 0 ||
    tooLow ||
    tooHigh;

  const handleMax = () => {
    setAmount(available > 0 ? available.toString() : "");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (tooLow) {
      toast.error(`Minimum cashout is ${formatCurrency(minCashout)}`);
      return;
    }
    if (tooHigh) {
      toast.error("Amount exceeds your available balance");
      return;
    }
    if (numericAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setIsSubmitting(true);
    try {
      await requestCashout({
        amount: numericAmount,
        accountName: accountName.trim(),
        accountNumber: accountNumber.trim(),
        bankName: bankName.trim(),
      });
      toast.success("Cash-out request submitted!");
      setAmount("");
      setAccountName("");
      setAccountNumber("");
      setBankName("");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit cash-out request");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <CashoutSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* ---------- Header ---------- */}
      <div>
        <h1 className="text-2xl font-bold text-white">Cash Out</h1>
        <p className="mt-1 text-sm text-dark-400">
          Withdraw your earnings directly to your bank account.
        </p>
      </div>

      {/* ---------- Balance + form ---------- */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Balance card */}
        <div className="card p-6 lg:col-span-1">
          <div className="flex items-center gap-2 text-dark-400">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Available Balance
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold text-white">
            {formatCurrency(available)}
          </p>
          <div className="mt-4 space-y-2 border-t border-dark-800 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-dark-400">Pending</span>
              <span className="font-medium text-dark-200">
                {formatCurrency(wallet?.pending ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-dark-400">Total Withdrawn</span>
              <span className="font-medium text-dark-200">
                {formatCurrency(wallet?.totalWithdrawn ?? 0)}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-primary-500/10 px-3 py-2 text-xs text-primary-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Minimum cash-out amount is {formatCurrency(minCashout)}.</span>
          </div>
        </div>

        {/* Cash-out form */}
        <form onSubmit={handleSubmit} className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="text-base font-semibold text-white">
              Request Cash-Out
            </h2>
            <Banknote className="h-4 w-4 text-primary-400" />
          </div>
          <div className="card-body space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              {/* Account Name */}
              <div>
                <label htmlFor="co-account-name" className="label">
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Account Name
                  </span>
                </label>
                <input
                  id="co-account-name"
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="John Doe"
                  className="input"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* Account Number */}
              <div>
                <label htmlFor="co-account-number" className="label">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    Account Number
                  </span>
                </label>
                <input
                  id="co-account-number"
                  type="text"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="0123456789"
                  className="input"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* Bank Name */}
              <div>
                <label htmlFor="co-bank-name" className="label">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    Bank Name
                  </span>
                </label>
                <input
                  id="co-bank-name"
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="First Bank"
                  className="input"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* Amount */}
              <div>
                <label htmlFor="co-amount" className="label">
                  <span className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                      Amount
                    </span>
                    <button
                      type="button"
                      onClick={handleMax}
                      className="text-xs font-semibold text-primary-400 hover:text-primary-300"
                    >
                      Max
                    </button>
                  </span>
                </label>
                <input
                  id="co-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className={cn("input", (tooLow || tooHigh) && "input-error")}
                  disabled={isSubmitting}
                  required
                />
                {tooLow && (
                  <p className="mt-1.5 text-xs text-error-400">
                    Minimum is {formatCurrency(minCashout)}.
                  </p>
                )}
                {tooHigh && (
                  <p className="mt-1.5 text-xs text-error-400">
                    Exceeds available balance ({formatCurrency(available)}).
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isSubmitting || formInvalid}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <ArrowDownToLine className="h-4 w-4" />
                  Request Cash-Out
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ---------- Payment instructions ---------- */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">
            Payment Instructions
          </h2>
          <Info className="h-4 w-4 text-dark-400" />
        </div>
        <div className="card-body">
          <p className="text-sm text-dark-400">
            Cash-outs are processed to the account details you provide above.
            For registration fee or deposit payments, use the platform account
            below.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-dark-800 bg-dark-800/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-dark-500">
                Provider
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {paymentProvider || "—"}
              </p>
            </div>
            <div className="rounded-lg border border-dark-800 bg-dark-800/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-dark-500">
                Account Name
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {paymentAccountName || "—"}
              </p>
            </div>
            <div className="rounded-lg border border-dark-800 bg-dark-800/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-dark-500">
                Account Number
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-white">
                {paymentAccountNumber || "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Cash-out history ---------- */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-base font-semibold text-white">
            Cash-Out History
          </h2>
          <span className="text-xs text-dark-500">
            {cashouts.length} {cashouts.length === 1 ? "request" : "requests"}
          </span>
        </div>
        {cashouts.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="No cash-outs yet"
            description="Your withdrawal requests will appear here once you submit one."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-800">
                  <th className="table-header">Amount</th>
                  <th className="table-header">Bank</th>
                  <th className="table-header">Account</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-800">
                {cashouts.map((c) => {
                  const SIcon = statusIcon[c.status];
                  return (
                    <tr key={c._id} className="hover:bg-dark-800/30">
                      <td className="table-cell font-semibold text-white">
                        {formatCurrency(c.amount)}
                      </td>
                      <td className="table-cell">{c.bankName}</td>
                      <td className="table-cell">
                        <div className="flex flex-col">
                          <span>{c.accountName}</span>
                          <span className="font-mono text-xs text-dark-500">
                            {c.accountNumber}
                          </span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <Badge variant={statusVariant[c.status]}>
                          <SIcon className="h-3 w-3" />
                          {c.status}
                        </Badge>
                        {c.status === "rejected" && c.adminNote && (
                          <p className="mt-1 text-xs text-error-400">
                            {c.adminNote}
                          </p>
                        )}
                      </td>
                      <td className="table-cell text-dark-400">
                        {formatDate(c.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
