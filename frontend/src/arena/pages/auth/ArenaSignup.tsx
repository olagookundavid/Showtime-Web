import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Field, Input } from '../../../components';
import { useAuth } from '../../../contexts';
import { useReturnUrl, withReturnUrl } from '../../../hooks';
import { AuthCard } from './AuthCard';

// The server's rule, checked here first so the message appears before the request.
const PASSWORD_RULE = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_HINT = 'Use at least 8 characters, with a number and a symbol.';

export const ArenaSignup = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const returnUrl = useReturnUrl();

  useEffect(() => {
    if (isAuthenticated) navigate(returnUrl, { replace: true });
  }, [isAuthenticated, navigate, returnUrl]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('The two passwords do not match.');
    if (!PASSWORD_RULE.test(password)) return setError(PASSWORD_HINT);
    setLoading(true);
    const result = await signup(firstName, lastName, email, password);
    setLoading(false);
    if (result.success) navigate(returnUrl, { replace: true });
    else setError(result.error || 'We could not create your account. Please try again.');
  };

  return (
    <AuthCard
      title="Join Clubs Arena"
      subtitle="One account for your player profile, your club and your contracts."
      footer={
        <>
          Already have an account?{' '}
          <Link to={withReturnUrl('/login', returnUrl)} className="font-bold text-sffl-red hover:underline dark:text-arena-lime">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="su-first">
            <Input id="su-first" autoComplete="given-name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="Last name" htmlFor="su-last">
            <Input id="su-last" autoComplete="family-name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
        </div>
        <Field label="Email address" htmlFor="su-email">
          <Input id="su-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="su-password" hint={PASSWORD_HINT}>
          <Input id="su-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password" htmlFor="su-confirm">
          <Input id="su-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" variant="navy" size="lg" fullWidth loading={loading}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
};
