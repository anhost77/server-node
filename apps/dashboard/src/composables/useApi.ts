import { ref } from 'vue'

// Base URL configuration
const baseUrl = window.location.origin.includes(':5173')
  ? window.location.origin.replace(':5173', ':3000')
  : window.location.origin

const wsUrl = baseUrl.replace('http', 'ws') + '/api/dashboard/ws'

// Global loading state
const globalLoading = ref(false)

export function useApi() {
  /**
   * Make an authenticated API request
   * @param path - API endpoint path (e.g., '/api/servers')
   * @param options - Fetch options
   * @returns Parsed JSON response or error object
   */
  async function request<T = any>(path: string, options?: RequestInit): Promise<T> {
    try {
      const fetchOptions: RequestInit = {
        ...options,
        credentials: 'include'
      }

      const res = await fetch(`${baseUrl}${path}`, fetchOptions)

      if (res.status === 401) {
        return { error: 'Unauthorized' } as T
      }

      return await res.json()
    } catch (e) {
      return { error: 'Network error' } as T
    }
  }

  /**
   * Make a GET request
   */
  async function get<T = any>(path: string): Promise<T> {
    return request<T>(path)
  }

  /**
   * Make a POST request with JSON body
   */
  async function post<T = any>(path: string, data?: any): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    })
  }

  /**
   * Make a PUT request with JSON body
   */
  async function put<T = any>(path: string, data?: any): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    })
  }

  /**
   * Make a DELETE request
   */
  async function del<T = any>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' })
  }

  /**
   * Download a file (blob response)
   */
  async function download(path: string): Promise<Blob | null> {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        credentials: 'include'
      })
      if (res.ok) {
        return await res.blob()
      }
      return null
    } catch (e) {
      return null
    }
  }

  return {
    request,
    get,
    post,
    put,
    del,
    download,
    baseUrl,
    wsUrl,
    globalLoading
  }
}
