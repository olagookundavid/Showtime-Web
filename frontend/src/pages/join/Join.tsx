import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { Button, ButtonLink, Checkbox, Field, Input } from "../../components";
import { joinInterestList } from "../../services";
import { LEAD_INTERESTS } from "../../constants";
import { getApiErrorMessage } from "../../utils";
import type { LeadInterest } from "../../types";

/**
 * The public page the social media and community teams share with people who ask
 * about joining Showtime. `?src=instagram` (or whatsapp, a poster...) says which
 * link brought them, so we can see which channels work.
 */
const Join = () => {
  const [params] = useSearchParams();
  const source = params.get("src") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interests, setInterests] = useState<LeadInterest[]>([]);
  const [consent, setConsent] = useState(false);
  // A hidden field: people never see it, bots fill it in.
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = "Join the Showtime community — Showtime";
  }, []);

  const toggleInterest = (value: LeadInterest) =>
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value],
    );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (interests.length === 0) {
      setError("Please pick at least one thing you are interested in.");
      return;
    }
    setLoading(true);
    try {
      await joinInterestList({
        name,
        email,
        phone,
        interests,
        source,
        consent,
        website,
      });
      setDone(true);
    } catch (err) {
      const message = getApiErrorMessage(
        err,
        "We could not save your details. Please try again.",
      );
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80dvh] flex items-center justify-center bg-transparent transition-colors">
      <div className="max-w-md w-full bg-white/10 dark:bg-slate-900/50 backdrop-blur-sm border border-white/10 rounded-2xl shadow-xl p-5 sm:p-8">
        <div className="text-center mb-8">
          <img
            src="/images/branding/showtime-logo.webp"
            alt="Showtime logo"
            className="w-20 h-20 mx-auto mb-4 bg-white rounded-full p-2"
          />
          <h1 className="text-2xl sm:text-3xl font-black text-sffl-navy dark:text-white">
            Join the Showtime community
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Tell us what you are interested in and we will invite you to game
            days.
          </p>
        </div>

        {done ? (
          <div className="text-center space-y-4" role="status">
            <CheckCircleIcon
              className="w-14 h-14 mx-auto text-green-600"
              aria-hidden="true"
            />
            <h2 className="text-xl font-black text-sffl-navy dark:text-white">
              You are on the list
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Thanks, {name.trim().split(" ")[0]}. We will be in touch with the
              next game day.
            </p>
            <ButtonLink to="/tickets" fullWidth size="lg">
              See game day tickets
            </ButtonLink>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm"
                role="alert"
              >
                {error}
              </div>
            )}

            <Field label="Full name" htmlFor="join-name">
              <Input
                id="join-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your full name"
              />
            </Field>
            <Field label="Email" htmlFor="join-email">
              <Input
                id="join-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </Field>
            <Field
              label="Phone number"
              htmlFor="join-phone"
              hint="We may use it to share game-day details on WhatsApp."
            >
              <Input
                id="join-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="0803 000 0000"
              />
            </Field>

            <fieldset className="space-y-1">
              <legend className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">
                I am interested in
              </legend>
              {LEAD_INTERESTS.map((interest) => (
                <Checkbox
                  key={interest.value}
                  label={interest.label}
                  hint={interest.hint}
                  checked={interests.includes(interest.value)}
                  onChange={() => toggleInterest(interest.value)}
                />
              ))}
            </fieldset>

            {/* Hidden from people; bots fill every field they find. */}
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="join-website">Website</label>
              <input
                id="join-website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <Checkbox
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              label="Email and message me about Showtime game days, coaches and playing opportunities. I can unsubscribe at any time."
            />

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              disabled={!consent || !name.trim() || !email.trim() || !phone.trim()}
            >
              {loading ? "Saving…" : "Join the list"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Join;
