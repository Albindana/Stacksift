'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@/app/components/ui';
import { useToastStore } from '@/app/hooks/useToastStore';
import { trackEvent, AnalyticsEvent } from '@/app/lib/analytics';
import {
  registerApiResultSchema,
  registerSchema,
  type RegisterFormValues,
} from '@/app/lib/schemas/auth';
import { TurnstileWidget } from './TurnstileWidget';

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const inviteOnly = process.env.NEXT_PUBLIC_REGISTRATION_INVITE_ONLY === 'true';

const ROLE_OPTIONS: Array<{
  value: RegisterFormValues['role'];
  title: string;
  description: string;
}> = [
  {
    value: 'owner',
    title: "I'm registering my team or company",
    description: "You'll create an organisation and invite teammates.",
  },
  {
    value: 'viewer',
    title: "I'm joining a team that's already on StackSift",
    description: 'An owner will add you to their organisation.',
  },
];

function RegisterForm() {
  const router = useRouter();
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const { addToast } = useToastStore();
  const [submitting, setSubmitting] = useState(false);

  // Invitation token carried from the invite email's register link. Proves
  // inbox ownership — the backend creates the account pre-verified, so the
  // user skips the verification round-trip entirely.
  const inviteToken = search.get('invite') ?? '';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      displayName: '',
      role: 'viewer',
      captchaToken: '',
      honeypot: '',
      invitationToken: inviteToken,
    },
  });

  const selectedRole = watch('role');

  async function onSubmit(values: RegisterFormValues): Promise<void> {
    setSubmitting(true);
    try {
      const registerResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (registerResponse.status === 409) {
        addToast({
          variant: 'error',
          message: 'That email is already registered. Try signing in instead.',
        });
        return;
      }
      if (registerResponse.status === 403) {
        addToast({
          variant: 'error',
          message:
            'Registration is currently invite-only. Ask an organisation owner to invite you.',
        });
        return;
      }
      if (registerResponse.status === 400) {
        addToast({
          variant: 'error',
          message:
            'Some of your details were rejected. Check the form and try again.',
        });
        return;
      }
      if (!registerResponse.ok) {
        addToast({
          variant: 'error',
          message: 'Could not create your account. Please try again.',
        });
        return;
      }

      const rawJson: unknown = await registerResponse.json();
      const parsed = registerApiResultSchema.safeParse(rawJson);
      if (!parsed.success) {
        addToast({
          variant: 'error',
          message: 'Unexpected response from the server. Please try again.',
        });
        return;
      }
      const result = parsed.data;

      // Acquisition: the account now exists (fires for both the verify-email
      // and the auto-login branches below). No PII in params.
      trackEvent(AnalyticsEvent.SignUp, {
        attached_via_invitation: result.attachedViaInvitation,
      });

      // Unverified accounts cannot complete a login (realm policy), so don't
      // attempt the auto sign-in — route to the verification screen instead,
      // and be honest when the verification email could not be sent.
      if (!result.emailVerified) {
        if (result.verificationEmailSent) {
          addToast({
            variant: 'success',
            message: 'Account created — check your inbox to verify your email, then sign in.',
          });
        } else {
          addToast({
            variant: 'warning',
            message:
              "Account created, but we couldn't send the verification email. Request a new one below.",
          });
        }
        router.replace(`/verify-email?email=${encodeURIComponent(values.email)}`);
        return;
      }

      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: values.email, password: values.password }),
      });
      if (!loginResponse.ok) {
        addToast({
          variant: 'error',
          message: 'Account created — please sign in.',
        });
        router.replace('/login');
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });

      if (result.attachedViaInvitation) {
        addToast({
          variant: 'success',
          message: "You've been added to your organisation.",
        });
        router.replace('/');
      } else if (result.role === 'owner') {
        router.replace('/onboarding');
      } else {
        router.replace('/waiting');
      }
      return;
    } catch {
      addToast({
        variant: 'error',
        message: 'Could not create your account. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel =
    selectedRole === 'owner' ? 'Create my organisation' : 'Join an organisation';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-8 shadow-xl"
      noValidate
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Create your StackSift account</h1>
        <p className="text-sm text-muted">It takes less than a minute.</p>
      </div>

      <div className="flex flex-col gap-4">
        <Input
          label="Display name"
          autoComplete="name"
          errorMessage={errors.displayName?.message}
          {...register('displayName')}
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          errorMessage={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          errorMessage={errors.password?.message}
          helperText="At least 12 characters, with an uppercase letter, a lowercase letter, and a digit."
          {...register('password')}
        />
      </div>

      {inviteToken ? (
        <p className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 text-xs text-muted">
          You&apos;re registering with an invitation. Use the email address the
          invitation was sent to — your account will be verified automatically.
        </p>
      ) : null}

      {inviteOnly ? (
        <p className="rounded-lg border border-line bg-elevated p-3 text-xs text-muted">
          StackSift is invite-only right now. Register with the email an owner invited
          and you&apos;ll join their organisation automatically.
        </p>
      ) : (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">What brings you here?</legend>
          {ROLE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-elevated p-3 transition-colors hover:bg-line/40 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-500/10"
            >
              <input
                type="radio"
                value={option.value}
                className="mt-1"
                {...register('role')}
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{option.title}</span>
                <span className="text-xs text-muted">{option.description}</span>
              </span>
            </label>
          ))}
          {errors.role?.message ? (
            <p className="text-xs text-red-500" role="alert">
              {errors.role.message}
            </p>
          ) : null}
        </fieldset>
      )}

      {/* Honeypot — hidden from users; bots that fill it are silently dropped. */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        {...register('honeypot')}
      />

      {turnstileSiteKey ? (
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          onVerify={(token) => setValue('captchaToken', token)}
        />
      ) : null}

      <Button type="submit" variant="primary" loading={submitting} className="w-full">
        {submitLabel}
      </Button>

      <p className="text-center text-xs text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-500 hover:underline">
          Sign in
        </Link>
        .
      </p>
    </form>
  );
}

export default function RegisterPage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
