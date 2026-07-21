import { clearAdminSession } from '@/lib/admin-auth'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    await clearAdminSession()
    return NextResponse.json(
      { success: true, message: 'Logout successful' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'An error occurred during logout' },
      { status: 500 }
    )
  }
}
