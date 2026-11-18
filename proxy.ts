import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { supabaseEnv } from "@/lib/supabase/env"

/**
 * Refreshes the Supabase session cookie on navigation so server components
 * and route handlers always see a live session. (Next.js 16 renamed the
 * middleware convention to `proxy`.)
 */
export function proxy(request: NextRequest) {
  return handleRequest(request)
}

async function handleRequest(request: NextRequest) {
  let response = NextResponse.next({ request })

  let url: string
  let anonKey: string
  try {
    ;({ url, anonKey } = supabaseEnv())
  } catch {
    // Not configured yet: let the page render its setup message.
    return response
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
