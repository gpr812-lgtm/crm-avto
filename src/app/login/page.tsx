'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Car, Lock, Mail } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading, login, loadUser } = useAuthStore()
  const [email, setEmail] = useState('admin@crm.local')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadUser()
  }, [loadUser])

  useEffect(() => {
    if (!loading && user) {
      router.push('/')
    }
  }, [user, loading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const ok = await login(email, password)
    if (ok) {
      router.push('/')
    } else {
      setError('Неверный email или пароль')
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,23%,96%)]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl crm-header-gradient flex items-center justify-center">
            <Car className="w-8 h-8 text-white" />
          </div>
          <p className="text-sm text-[hsl(215,16%,47%)]">Загрузка...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(224,56%,25%)] to-[hsl(221,60%,38%)] p-4">
      <Card className="w-full max-w-md p-8 crm-card-shadow">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl crm-header-gradient flex items-center justify-center">
            <Car className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-[hsl(215,28%,22%)]">CRM Отдел продаж</h1>
          <p className="text-xs text-[hsl(215,16%,47%)] mt-1">Войдите в систему</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(215,16%,60%)]" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                placeholder="admin@crm.local"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password">Пароль</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(215,16%,60%)]" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-[hsl(0,72%,50%)] bg-[hsl(0,70%,96%)] border border-[hsl(0,60%,80%)] rounded p-2 text-center">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[hsl(221,60%,38%)] hover:bg-[hsl(221,60%,33%)]"
          >
            {submitting ? 'Вход...' : 'Войти'}
          </Button>
        </form>

        <div className="mt-6 text-center text-[10px] text-[hsl(215,16%,60%)]">
          Демо: admin@crm.local / admin123
        </div>
      </Card>
    </div>
  )
}
