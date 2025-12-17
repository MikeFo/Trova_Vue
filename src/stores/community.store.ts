import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Community } from '@/services/community.service';

export const useCommunityStore = defineStore('community', () => {
  const currentCommunity = ref<Community | null>(null);
  const communities = ref<Community[]>([]);

  const currentCommunityId = computed(() => currentCommunity.value?.id || null);
  const currentCommunityLogo = computed(() => {
    if (currentCommunity.value === null) {
      // Global view - return null to show default logo
      return null;
    }
    return currentCommunity.value?.logo || null;
  });
  const currentCommunityName = computed(() => {
    if (currentCommunity.value === null) {
      return 'All Communities';
    }
    return currentCommunity.value?.name || 'Trova';
  });
  const isGlobalView = computed(() => currentCommunity.value === null);

  function setCurrentCommunity(community: Community | null) {
    currentCommunity.value = community;
    // Persist to localStorage
    if (community) {
      localStorage.setItem('currentCommunityId', String(community.id));
      localStorage.removeItem('isGlobalView');
    } else {
      // Global view
      localStorage.removeItem('currentCommunityId');
      localStorage.setItem('isGlobalView', 'true');
    }
  }

  function setCommunities(newCommunities: Community[]) {
    const previousCount = communities.value.length;
    communities.value = newCommunities;
    
    // Validate current community still exists in the new list
    if (currentCommunity.value) {
      const stillExists = newCommunities.find(c => c.id === currentCommunity.value!.id);
      if (!stillExists) {
        // Current community no longer exists, need to select a new one
        console.log('[CommunityStore] Current community no longer exists, selecting new one');
        currentCommunity.value = null;
      } else {
        // Update the current community object to ensure it has the latest data
        const updatedCommunity = newCommunities.find(c => c.id === currentCommunity.value!.id);
        if (updatedCommunity) {
          currentCommunity.value = updatedCommunity;
        }
      }
    }
    
    // If no community is selected, restore from localStorage or default
    if (!currentCommunity.value) {
      const isGlobal = localStorage.getItem('isGlobalView') === 'true';
      if (isGlobal) {
        // Restore global view
        setCurrentCommunity(null);
        return;
      }
      
      const savedCommunityId = localStorage.getItem('currentCommunityId');
      if (savedCommunityId) {
        const savedCommunity = newCommunities.find(c => String(c.id) === savedCommunityId);
        if (savedCommunity) {
          setCurrentCommunity(savedCommunity);
          return;
        }
      }
      
      // Default to first community if we have communities
      if (newCommunities.length > 0) {
        setCurrentCommunity(newCommunities[0]);
      }
    }
    
    // Log if communities were added
    if (newCommunities.length > previousCount) {
      console.log(`[CommunityStore] Communities updated: ${previousCount} -> ${newCommunities.length}`);
    }
  }

  function getCommunityById(id: number): Community | null {
    return communities.value.find(c => c.id === id) || null;
  }

  return {
    currentCommunity,
    communities,
    currentCommunityId,
    currentCommunityLogo,
    currentCommunityName,
    isGlobalView,
    setCurrentCommunity,
    setCommunities,
    getCommunityById,
  };
});

