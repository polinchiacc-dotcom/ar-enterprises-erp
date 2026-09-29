import { useState, useEffect } from "react";

export function useQuery<T = any>(route: string, params: any = {}, deps: any[] = [], enabled: boolean = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    // In production this calls Google Apps Script gateway or mock
    const t = setTimeout(() => {
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [...deps, enabled]);

  return { data, loading, error, refetch: () => {} };
}
