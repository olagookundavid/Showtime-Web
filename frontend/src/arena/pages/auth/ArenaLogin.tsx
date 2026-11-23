import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button, Field, Input } from '../../../components';
import { useAuth } from '../../../contexts';
import { useReturnUrl, withReturnUrl } from '../../../hooks';
import { AuthCard } from './AuthCard';

export const ArenaLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const returnUrl = useReturnUrl();

  useEffect(() => {
    if (isAuthenticated) navigate(returnUrl, { replace: true });
  }, [isAuthenticated, navigate, returnUrl]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      toast.success('Welcome back.');
      navigate(returnUrl, { replace: true });
    } else if (result.mustReset) {
      toast.error(result.error || 'Please reset your temporary password.');
      navigate('/forgot-password', { state: { email } });
    } else {
      toast.error(result.error || 'Those details did not match an account.');
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to manage your club, sign contracts and follow your team."
      footer={
        <>
          New to Clubs Arena?{' '}
          <Link to={withReturnUrl('/signup', returnUrl)} className="font-bold text-sffl-red hover:underline dark:text-arena-lime">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email address" htmlFor="login-email">
          <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm font-bold text-sffl-red hover:underline dark:text-arena-lime">
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" variant="navy" size="lg" fullWidth loading={loading}>
          Log in
        </Button>
      </form>
    </AuthCard>
  );
};
