// Environment loader - selects the correct environment based on Vite's build mode
// Modes: 'development' (local), 'staging', 'production'
import { environment as localEnv } from './environment.local';
import { environment as stagingEnv } from './environment.staging';
import { environment as prodEnv } from './environment.prod';

const mode = import.meta.env.MODE;

function isStagingHostname(): boolean {
  // Netlify / hosting misconfig can accidentally build staging with production mode.
  // Force staging config when running on a staging hostname to avoid hitting prod APIs.
  if (typeof window === 'undefined') return false;
  const host = window.location?.host || '';
  return host.includes('trova-staging.com') || host.includes('trova-api-staging') || host.includes('trova-staging');
}

export const environment =
  isStagingHostname() ? stagingEnv :
  mode === 'production' ? prodEnv :
  mode === 'staging' ? stagingEnv :
  localEnv; // Default to local for development

