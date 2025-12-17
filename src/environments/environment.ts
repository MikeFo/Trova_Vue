// Environment loader - selects the correct environment based on Vite's build mode
// Modes: 'development' (local), 'staging', 'production'
import { environment as localEnv } from './environment.local';
import { environment as stagingEnv } from './environment.staging';
import { environment as prodEnv } from './environment.prod';

const mode = import.meta.env.MODE;

export const environment = 
  mode === 'production' ? prodEnv :
  mode === 'staging' ? stagingEnv :
  localEnv; // Default to local for development

