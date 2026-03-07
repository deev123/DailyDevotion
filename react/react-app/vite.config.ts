import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: "/DailyDevotion/", // github pages cant find resources if you dont specify this
  plugins: [react()],
})
