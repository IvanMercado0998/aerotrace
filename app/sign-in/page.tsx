// app/sign-in/page.tsx
// DO NOT CHANGE LOGIC CALLS
import { isAdminLoggedIn } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { AdminLoginForm } from '@/components/auth-form'
 
export default async function SignInPage() {
  const loggedIn = await isAdminLoggedIn()
  if (loggedIn) redirect('/dashboard')
  return <AdminLoginForm />
}
 