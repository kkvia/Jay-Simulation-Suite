// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 必須與你的 GitHub Repo 名稱一致
  base: '/Jay-Simulation-Suite/', 
  plugins: [react()],
})