#!/usr/bin/env node
/**
 * Copia accessToken, refreshToken y expiresAt desde ~/.claude/.credentials.json
 * a ~/.openclaw/agents/main/agent/auth-profiles.json para que OpenClaw use el token de Claude.
 *
 * Uso:
 *   1. Refresca el token de Claude en tu terminal: claude "hola"
 *   2. Ejecuta: node scripts/sync-claude-token-to-openclaw.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { homedir } from 'node:os'

const CLAUDE_CRED = path.join(homedir(), '.claude', '.credentials.json')
const OPENCLAW_AUTH = path.join(homedir(), '.openclaw', 'agents', 'main', 'agent', 'auth-profiles.json')

const credPath = process.env.CLAUDE_CREDENTIALS_PATH || CLAUDE_CRED
const authPath = process.env.OPENCLAW_AUTH_PROFILES_PATH || OPENCLAW_AUTH

if (!fs.existsSync(credPath)) {
  console.error('❌ No se encontró:', credPath)
  console.error('   Refresca el token ejecutando en tu terminal: claude "hola"')
  process.exit(1)
}

if (!fs.existsSync(authPath)) {
  console.error('❌ No se encontró:', authPath)
  process.exit(1)
}

const credRaw = fs.readFileSync(credPath, 'utf-8')
let cred
try {
  cred = JSON.parse(credRaw)
} catch (e) {
  console.error('❌ .credentials.json inválido:', e.message)
  process.exit(1)
}

const oauth = cred.claudeAiOauth || cred.oauth
if (!oauth || !oauth.accessToken) {
  console.error('❌ No hay accessToken en', credPath)
  process.exit(1)
}

const authRaw = fs.readFileSync(authPath, 'utf-8')
let auth
try {
  auth = JSON.parse(authRaw)
} catch (e) {
  console.error('❌ auth-profiles.json inválido:', e.message)
  process.exit(1)
}

const profileKey = 'anthropic:manual'
if (!auth.profiles || !auth.profiles[profileKey]) {
  console.error('❌ No existe perfil', profileKey, 'en auth-profiles.json')
  process.exit(1)
}

auth.profiles[profileKey].token = oauth.accessToken
auth.profiles[profileKey].refreshToken = oauth.refreshToken || auth.profiles[profileKey].refreshToken
if (oauth.expiresAt != null) auth.profiles[profileKey].expiresAt = oauth.expiresAt

fs.writeFileSync(authPath, JSON.stringify(auth, null, 2), 'utf-8')
console.log('✅ Token de Claude copiado a OpenClaw.')
console.log('   Reinicia el gateway si está corriendo: pkill -f openclaw-gateway; nohup openclaw gateway run > /tmp/openclaw-gateway.log 2>&1 &')
