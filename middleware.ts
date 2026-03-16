import { NextResponse, type NextRequest } from 'next/server'
import { DEFAULT_DASHBOARD_ROUTE } from './app/lib/constants/routes'

const PUBLIC_PATHS = new Set(['/login', '/register', '/forgot-password', '/reset-password', '/'])
const ADMIN_PATHS = new Set(['/admin'])
const BLOCKED_PATHS = new Set(['/reports'])

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  
  // Allow Next.js internal routes, static assets, and uploads
  if (pathname.startsWith('/_next') || pathname.startsWith('/assets') || pathname.startsWith('/uploads')) {
    return NextResponse.next()
  }
  
  // Allow public paths without authentication
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  // Check for token cookie
  const token = req.cookies.get('token')?.value
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // Verify token is valid by calling the API
  // This ensures expired or invalid tokens don't allow access
  try {
    const response = await fetch(`${req.nextUrl.origin}/api/user`, {
      headers: {
        'Cookie': `token=${token}`,
      },
      credentials: 'include'
    })

    if (!response.ok) {
      // Token is invalid or expired - redirect to login
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      // Clear invalid token cookie
      const redirect = NextResponse.redirect(url)
      redirect.cookies.delete('token')
      return redirect
    }

    const responseData = await response.json()
    const user = responseData.data?.user || responseData.user

    // Block access to blocked paths
    if (BLOCKED_PATHS.has(pathname)) {
      const url = req.nextUrl.clone()
      url.pathname = DEFAULT_DASHBOARD_ROUTE
      return NextResponse.redirect(url)
    }

    // Check admin access for admin routes
    if (ADMIN_PATHS.has(pathname) || pathname.startsWith('/admin/')) {
      if (user?.role !== 'admin') {
        const url = req.nextUrl.clone()
        url.pathname = DEFAULT_DASHBOARD_ROUTE
        return NextResponse.redirect(url)
      }
    }

    // Token is valid and user has appropriate access
    return NextResponse.next()
  } catch (error) {
    // If we can't verify the token, redirect to login for safety
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    const redirect = NextResponse.redirect(url)
    redirect.cookies.delete('token')
    return redirect
  }
}

export const config = {
  matcher: ['/((?!api).*)'],
}


