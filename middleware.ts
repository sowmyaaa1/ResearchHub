import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // First, handle standard Supabase session updates
  let response = await updateSession(request);

  // Additional admin route protection
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: any) {
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('Admin access denied: User not authenticated')
      return NextResponse.redirect(new URL('/login?message=Please log in to access admin area', request.url))
    }

    // Check if user has admin role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      console.error('Error fetching user profile for admin access:', profileError)
      return NextResponse.redirect(new URL('/dashboard?error=Profile not found', request.url))
    }

    if (profile.role !== 'admin') {
      console.warn(`Unauthorized admin access attempt by ${profile.email} (${user.id}) with role: ${profile.role} to ${request.nextUrl.pathname}`)
      return NextResponse.redirect(new URL('/dashboard?error=Access denied: Admin privileges required', request.url))
    }

    // Log successful admin access
    console.log(`Admin access granted to ${profile.email} (${user.id}) for ${request.nextUrl.pathname}`)
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
