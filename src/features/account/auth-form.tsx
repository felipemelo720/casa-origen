'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from '@/schemas/customer-auth.schema';
import {
  loginCustomerAction,
  registerCustomerAction,
} from '@/server/actions/customer-auth.actions';

type Mode = 'login' | 'register';

/**
 * Login and registration on one card, toggled in place.
 *
 * Two tabs rather than two pages: the account is a side quest off the ordering
 * flow, and a route change per mode costs a navigation for a form of 5 fields.
 */
export function AuthForm() {
  const [mode, setMode] = useState<Mode>('login');

  return (
    <div className="mx-auto w-full max-w-md">
      <div
        role="tablist"
        aria-label="Acceder o crear cuenta"
        className="bg-muted mb-6 grid grid-cols-2 gap-1 rounded-lg p-1"
      >
        {(['login', 'register'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`focus-visible:ring-ring min-h-11 rounded-md px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
              mode === value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {value === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        ))}
      </div>

      {mode === 'login' ? <LoginFields /> : <RegisterFields />}
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function LoginFields() {
  const router = useRouter();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await loginCustomerAction(values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`Hola de nuevo, ${result.data.firstName}.`);
    // The account page reads the session on the server, so the tree has to be
    // refetched — the cookie alone changes nothing already rendered.
    router.refresh();
  });

  const { errors, isSubmitting } = form.formState;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field id="login-email" label="Correo" error={errors.email?.message}>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          {...form.register('email')}
        />
      </Field>

      <Field id="login-password" label="Contraseña" error={errors.password?.message}>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'login-password-error' : undefined}
          {...form.register('password')}
        />
      </Field>

      {/* "Entrar", not "Iniciar sesión": the tab above already carries that
          label, and two controls with the same accessible name on one screen
          are ambiguous to anyone navigating by name. */}
      <Button type="submit" className="min-h-11 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Entrar
      </Button>
    </form>
  );
}

function RegisterFields() {
  const router = useRouter();
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await registerCustomerAction(values);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success('Cuenta creada. Tus pedidos quedarán guardados acá.');
    router.refresh();
  });

  const { errors, isSubmitting } = form.formState;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field id="register-first" label="Nombre" error={errors.firstName?.message}>
          <Input
            id="register-first"
            autoComplete="given-name"
            aria-invalid={Boolean(errors.firstName)}
            {...form.register('firstName')}
          />
        </Field>
        <Field id="register-last" label="Apellido" error={errors.lastName?.message}>
          <Input
            id="register-last"
            autoComplete="family-name"
            aria-invalid={Boolean(errors.lastName)}
            {...form.register('lastName')}
          />
        </Field>
      </div>

      <Field id="register-phone" label="Teléfono" error={errors.phone?.message}>
        <Input
          id="register-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+56 9 1234 5678"
          aria-invalid={Boolean(errors.phone)}
          {...form.register('phone')}
        />
      </Field>

      <Field id="register-email" label="Correo" error={errors.email?.message}>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...form.register('email')}
        />
      </Field>

      <Field id="register-password" label="Contraseña" error={errors.password?.message}>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby="register-password-hint"
          {...form.register('password')}
        />
        <p id="register-password-hint" className="text-muted-foreground text-xs">
          Mínimo 8 caracteres.
        </p>
      </Field>

      <Button type="submit" className="min-h-11 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Registrarme
      </Button>
    </form>
  );
}
