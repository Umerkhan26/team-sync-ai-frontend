import { configureStore } from '@reduxjs/toolkit'
import {
  useDispatch,
  useSelector,
  type TypedUseSelectorHook,
} from 'react-redux'
import authReducer from './authSlice'
import uiReducer from './uiSlice'
import orgReducer from './orgSlice'
import presenceReducer from './presenceSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    org: orgReducer,
    presence: presenceReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector
