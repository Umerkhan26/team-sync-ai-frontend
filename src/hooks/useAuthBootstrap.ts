import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/services/authApi'
import { useAppDispatch, useAppSelector } from '@/store'
import { logout, setInitialized, setUser } from '@/store/authSlice'

export function useAuthBootstrap() {
  const dispatch = useAppDispatch()
  const accessToken = useAppSelector((s) => s.auth.accessToken)
  const initialized = useAppSelector((s) => s.auth.initialized)

  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    enabled: Boolean(accessToken),
    retry: false,
  })

  useEffect(() => {
    if (!accessToken) {
      dispatch(setInitialized(true))
      return
    }
    if (query.isSuccess && query.data) {
      dispatch(setUser(query.data))
      dispatch(setInitialized(true))
    }
    if (query.isError) {
      dispatch(logout())
      dispatch(setInitialized(true))
    }
  }, [
    accessToken,
    dispatch,
    query.data,
    query.isError,
    query.isSuccess,
  ])

  return { initialized, isLoading: Boolean(accessToken) && query.isLoading }
}
