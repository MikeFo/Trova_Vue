import { createPinia } from 'pinia';
import { createPersistedState } from 'pinia-plugin-persistedstate';

export const pinia = createPinia();

// Add persistence plugin
pinia.use(createPersistedState());

