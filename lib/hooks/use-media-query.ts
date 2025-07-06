// lib/hooks/use-media-query.ts
"use client"

import * as React from 'react'

/**
 * Hook para monitorar uma media query CSS e retornar se ela corresponde.
 * @param query A string da media query (ex: '(min-width: 768px)').
 * @returns `true` se a query corresponde, `false` caso contrário.
 */
export function useMediaQuery(query: string) {
  const [value, setValue] = React.useState(false)

  React.useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches)
    }

    const result = window.matchMedia(query)
    result.addEventListener('change', onChange)
    setValue(result.matches)

    return () => result.removeEventListener('change', onChange)
  }, [query])

  return value
}