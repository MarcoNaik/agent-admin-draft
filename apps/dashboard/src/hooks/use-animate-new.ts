"use client"

import { useRef, useState, useEffect, useMemo } from "react"

export function useAnimateNew<T>(
  items: T[] | undefined,
  keyFn: (item: T) => string
): Set<string> {
  const seenRef = useRef<Set<string>>(new Set())
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set())
  const initialLoadRef = useRef(true)

  const currentKeys = useMemo(() => {
    if (!items) return ""
    return items.map(keyFn).join(",")
  }, [items, keyFn])

  useEffect(() => {
    if (!items || items.length === 0) return

    if (initialLoadRef.current) {
      initialLoadRef.current = false
      seenRef.current = new Set(items.map(keyFn))
      return
    }

    const fresh = new Set<string>()
    for (const item of items) {
      const key = keyFn(item)
      if (!seenRef.current.has(key)) {
        fresh.add(key)
        seenRef.current.add(key)
      }
    }

    if (fresh.size > 0) {
      setNewKeys(prev => {
        const merged = new Set(prev)
        fresh.forEach(k => merged.add(k))
        return merged
      })

      const timer = setTimeout(() => {
        setNewKeys(prev => {
          const next = new Set(prev)
          fresh.forEach(k => next.delete(k))
          return next
        })
      }, 1500)

      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKeys])

  return newKeys
}

export const idKeyFn = (item: any) => item._id as string
