import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftIcon,
  BoltIcon,
  CheckIcon,
  EnvelopeIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import {
  createReferralCode,
  lookupReferrals,
} from "../../services/api";
import type { ReferralResponse } from "../../types/tickets";
import { Button, Field, Input } from "../../components/ui";

export const ReferralGenerator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"generate" | "lookup">("generate");

  // Generate state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<ReferralResponse | null>(
    null,
  );
  const [genError, setGenError] = useState("");
  const [copied, setCopied] = useState(false);

  // Lookup state
  const [searchName, setSearchName] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupResults, setLookupResults] = useState<ReferralResponse[]>([]);
  const [lookupError, setLookupError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setGenError("Name is required");
      return;
    }
    setGenError("");
    setGenerating(true);
    setGeneratedCode(null);

    try {
      const res = await createReferralCode({
        name: name.trim(),
        email: email.trim() || undefined,
      });
      setGeneratedCode(res);
      setName("");
      setEmail("");
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setGenError(
        error.response?.data?.error ||
          "Failed to generate referral code. Please try again.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchName.trim()) {
      setLookupError("Search name is required");
      return;
    }
    setLookupError("");
    setLookingUp(true);
    setLookupResults([]);

    try {
      const results = await lookupReferrals(searchName.trim());
      const safeResults = results || [];
      setLookupResults(safeResults);
      if (safeResults.length === 0) {
        setLookupError("No referral codes found for this name.");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setLookupError(
        error.response?.data?.error ||
          "Failed to search referral codes. Please try again.",
      );
    } finally {
      setLookingUp(false);
    }
  };

  const getReferralLink = (code: string) => {
    const domain = window.location.origin;
    return `${domain}/tickets?ref=${code}`;
  };

  const handleCopy = (link: string, index?: number) => {
    navigator.clipboard.writeText(link);
    if (index !== undefined) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto sm:py-4">
      {/* Header */}
      <div className="bg-sffl-navy text-white p-5 md:p-8 rounded-2xl shadow-xl text-center mb-6 sm:mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-sffl-red/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black italic tracking-tighter relative z-10 wrap-break-word">
          SFFL REFERRAL PROGRAM
        </h1>
        <p className="text-gray-300 mt-2 text-xs md:text-sm max-w-md mx-auto relative z-10">
          Invite friends to secure tickets for SFFL games, track completed
          sales, and earn rewards!
        </p>
        <div className="mt-4 inline-block">
          <Link
            to="/tickets"
            className="relative z-10 inline-flex items-center gap-1.5 min-h-11 text-sffl-red hover:underline text-xs font-bold"
          >
            <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
            Back to Tickets Page
          </Link>
        </div>
      </div>

      {/* Tab Control */}
      <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl mb-6 border border-gray-200/50 dark:border-gray-700/50">
        <Button
          className="flex-1"
          variant={activeTab === "generate" ? "secondary" : "ghost"}
          icon={TicketIcon}
          aria-pressed={activeTab === "generate"}
          onClick={() => setActiveTab("generate")}
        >
          Generate Code
        </Button>
        <Button
          className="flex-1"
          variant={activeTab === "lookup" ? "secondary" : "ghost"}
          icon={MagnifyingGlassIcon}
          aria-pressed={activeTab === "lookup"}
          onClick={() => setActiveTab("lookup")}
        >
          Look Up Code
        </Button>
      </div>

      {/* Content Container */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-md p-4 sm:p-6 md:p-8">
        {activeTab === "generate" ? (
          <div className="space-y-6">
            {!generatedCode ? (
              <form onSubmit={handleGenerate} className="space-y-4">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Create your referral link
                </h3>
                <Field
                  label={<>Your Full Name <span className="text-red-500">*</span></>}
                  htmlFor="referral-name"
                >
                  <Input
                    id="referral-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                  />
                </Field>
                <Field
                  label={<>Email Address <span className="text-gray-400 font-normal ml-1">(optional)</span></>}
                  htmlFor="referral-email"
                  hint="If provided, we will send your code and link via email."
                >
                  <Input
                    id="referral-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. john@example.com"
                  />
                </Field>

                {genError && (
                  <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-xs font-medium border border-red-200/50 dark:border-red-800/30">
                    {genError}
                  </div>
                )}

                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  icon={BoltIcon}
                  loading={generating}
                >
                  {generating ? "Generating…" : "Generate Referral Code"}
                </Button>
              </form>
            ) : (
              <div className="space-y-6 text-center animate-fade-in">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckIcon className="w-6 h-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Referral Code Created!
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 wrap-break-word">
                    Hello {generatedCode.name}, your code is active and ready to
                    share.
                  </p>
                </div>

                <div className="bg-linear-to-r from-sffl-navy to-slate-800 p-4 sm:p-6 rounded-xl border border-sffl-red/30">
                  <span className="text-[10px] font-bold text-sffl-red uppercase tracking-wider block mb-1">
                    Your Code
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-wider sm:tracking-widest block font-mono uppercase break-all">
                    {generatedCode.code}
                  </span>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-150 dark:border-gray-700 text-left">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    <LinkIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    Share this ticket link:
                  </span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      type="text"
                      readOnly
                      aria-label="Your referral link"
                      value={getReferralLink(generatedCode.code)}
                      className="flex-1 min-w-0"
                    />
                    <Button
                      className="shrink-0"
                      variant={copied ? "success" : "navy"}
                      onClick={() =>
                        handleCopy(getReferralLink(generatedCode.code))
                      }
                    >
                      {copied ? "Copied!" : "Copy Link"}
                    </Button>
                  </div>
                </div>

                {generatedCode.email && (
                  <p className="flex items-start justify-center gap-1.5 text-xs text-gray-500 italic">
                    <EnvelopeIcon
                      className="w-4 h-4 shrink-0 not-italic"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                    We have sent these details to{" "}
                    <span className="font-semibold text-gray-700 dark:text-gray-300 break-all">
                      {generatedCode.email}
                    </span>
                    .
                    </span>
                  </p>
                )}

                <Button variant="link" size="sm" onClick={() => setGeneratedCode(null)}>
                  Generate another code
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <form onSubmit={handleLookup} className="space-y-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Search existing referral codes
              </h3>
              <Field
                label={<>Enter Registered Name <span className="text-red-500">*</span></>}
                htmlFor="lookup-name"
              >
                <div className="flex flex-col min-[400px]:flex-row gap-2">
                  <Input
                    id="lookup-name"
                    type="text"
                    required
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="flex-1 min-w-0"
                  />
                  <Button
                    type="submit"
                    variant="navy"
                    className="shrink-0"
                    loading={lookingUp}
                  >
                    {lookingUp ? "Searching…" : "Search"}
                  </Button>
                </div>
              </Field>

              {lookupError && (
                <div className="bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-300 p-3 rounded-lg text-xs font-medium border border-amber-200/50 dark:border-amber-900/30">
                  {lookupError}
                </div>
              )}
            </form>

            {lookupResults && lookupResults.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <h4 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Matching Codes
                </h4>
                <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-72 overflow-y-auto pr-1">
                  {lookupResults.map((rc, idx) => (
                    <div
                      key={rc.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white wrap-break-word">
                          {rc.name}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono">
                          Code:{" "}
                          <span className="font-bold text-sffl-navy dark:text-white">
                            {rc.code}
                          </span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={copiedIndex === idx ? "success" : "primary"}
                          size="sm"
                          onClick={() =>
                            handleCopy(getReferralLink(rc.code), idx)
                          }
                        >
                          {copiedIndex === idx ? "Copied!" : "Copy Link"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
