import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Building2, Check, Globe2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { orgApi } from '@/services/orgApi'
import { useAppDispatch } from '@/store'
import { setActiveOrganization } from '@/store/orgSlice'
import { useSurfaceMode } from '@/hooks/useSurfaceMode'
import { cn, getErrorMessage } from '@/utils/cn'

const schema = z.object({
  name: z.string().min(1, 'Company name is required').max(120),
  slug: z.string().max(48).optional().or(z.literal('')),
  companySize: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']),
  industry: z.string().min(1, 'Industry is required').max(80),
  country: z.string().min(1, 'Country is required').max(80),
  website: z.string().url('Enter a valid URL').optional().or(z.literal('')),
  timezone: z.string().min(1),
  locale: z.string().min(2),
})

type FormValues = z.infer<typeof schema>

const steps = [
  { id: 1, title: 'Company', icon: Building2 },
  { id: 2, title: 'Profile', icon: Globe2 },
  { id: 3, title: 'Launch', icon: Users },
] as const

export function OnboardingPage() {
  useSurfaceMode('marketing')
  const [step, setStep] = useState(1)
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const queryClient = useQueryClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      slug: '',
      companySize: '1-10',
      industry: '',
      country: '',
      website: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      locale: navigator.language?.slice(0, 2) || 'en',
    },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      orgApi.create({
        name: values.name,
        slug: values.slug || undefined,
        companySize: values.companySize,
        industry: values.industry,
        country: values.country,
        website: values.website || undefined,
        timezone: values.timezone,
        locale: values.locale,
      }),
    onSuccess: async (result) => {
      dispatch(
        setActiveOrganization({
          organization: result.organization,
          membership: {
            membershipId: 'pending',
            roleId: 'owner',
            roleSlug: 'owner',
            roleName: 'Owner',
            permissions: [],
            status: 'active',
          },
        }),
      )
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
      toast.success('Company workspace ready')
      navigate('/app?setup=1')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })

  const next = async () => {
    if (step === 1) {
      const ok = await form.trigger(['name', 'companySize', 'industry'])
      if (ok) setStep(2)
      return
    }
    if (step === 2) {
      const ok = await form.trigger(['country', 'timezone', 'locale', 'website'])
      if (ok) setStep(3)
    }
  }

  const values = form.watch()
  const summary = useMemo(
    () => [
      { label: 'Company', value: values.name || '—' },
      { label: 'Size', value: values.companySize },
      { label: 'Industry', value: values.industry || '—' },
      { label: 'Country', value: values.country || '—' },
      { label: 'Timezone', value: values.timezone },
    ],
    [values],
  )

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader>
          <p className="brand-mark text-2xl font-semibold">TeamSync AI</p>
          <CardTitle className="mt-2">Set up your company</CardTitle>
          <CardDescription>
            We create your organization, Owner account link, default roles, and workspace settings.
          </CardDescription>
          <div className="mt-4 flex gap-2">
            {steps.map((s) => (
              <div
                key={s.id}
                className={cn(
                  'flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-xs',
                  step === s.id
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : step > s.id
                      ? 'border-border bg-muted text-foreground'
                      : 'border-border text-muted-foreground',
                )}
              >
                {step > s.id ? <Check className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
                {s.title}
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            noValidate
          >
            {step === 1 ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Company name</Label>
                  <Input id="name" {...form.register('name')} placeholder="TechNova" />
                  {form.formState.errors.name ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>Company size</Label>
                  <Select
                    value={form.watch('companySize')}
                    onValueChange={(v) =>
                      form.setValue('companySize', v as FormValues['companySize'])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['1-10', '11-50', '51-200', '201-1000', '1000+'].map((size) => (
                        <SelectItem key={size} value={size}>
                          {size} employees
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    {...form.register('industry')}
                    placeholder="Software / Agency / Education…"
                  />
                  {form.formState.errors.industry ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.industry.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Workspace slug (optional)</Label>
                  <Input id="slug" {...form.register('slug')} placeholder="technova" />
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" {...form.register('country')} placeholder="Pakistan" />
                  {form.formState.errors.country ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.country.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website (optional)</Label>
                  <Input
                    id="website"
                    {...form.register('website')}
                    placeholder="https://company.com"
                  />
                  {form.formState.errors.website ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.website.message}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input id="timezone" {...form.register('timezone')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locale">Language</Label>
                    <Input id="locale" {...form.register('locale')} placeholder="en" />
                  </div>
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Confirm launch. You become <strong>Organization Owner</strong>. Default roles
                  (Owner, Admin, Manager, Member, Guest) are created automatically.
                </p>
                <ul className="surface-panel divide-y divide-border overflow-hidden">
                  {summary.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-center justify-between px-3 py-2.5 text-sm"
                    >
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium">{row.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={step === 1 || mutation.isPending}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
              >
                Back
              </Button>
              {step < 3 ? (
                <Button type="button" onClick={() => void next()}>
                  Continue
                </Button>
              ) : (
                <Button type="submit" loading={mutation.isPending}>
                  Launch workspace
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
