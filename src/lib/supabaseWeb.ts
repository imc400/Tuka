import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

export const supabaseWeb = createClient(supabaseUrl, supabaseAnonKey, {
  // Supabase Pro optimizations
  global: {
    headers: {
      'x-client-info': 'grumo-web-dashboard',
    },
  },
  db: {
    schema: 'public',
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

/**
 * Helper: Execute query with automatic retry on transient errors
 * Optimized for Supabase Pro connection pooling
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Only retry on transient errors
      const isTransient =
        error.message?.includes('connection') ||
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNRESET') ||
        error.code === 'PGRST301';

      if (!isTransient || attempt === maxRetries - 1) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      console.log(`[Supabase] Retry attempt ${attempt + 1}/${maxRetries}`);
    }
  }

  throw lastError;
}

/**
 * Helper: Paginated query for large datasets
 * Supabase Pro supports larger result sets, but pagination is still recommended
 */
export async function paginatedQuery<T>(
  tableName: string,
  options: {
    select?: string;
    filters?: Record<string, any>;
    orderBy?: { column: string; ascending?: boolean };
    pageSize?: number;
  } = {}
): Promise<T[]> {
  const { select = '*', filters = {}, orderBy, pageSize = 1000 } = options;
  const allResults: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabaseWeb.from(tableName).select(select, { count: 'exact' });

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    // Apply ordering
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }

    // Apply pagination
    query = query.range(from, from + pageSize - 1);

    const { data, error, count } = await query;

    if (error) throw error;
    if (!data || data.length === 0) break;

    allResults.push(...(data as T[]));
    from += pageSize;
    hasMore = data.length === pageSize;
  }

  return allResults;
}
