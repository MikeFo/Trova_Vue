<template>
  <ion-page>
    <ion-content :fullscreen="true" class="map-content">
      <div class="map-layout">
        <!-- Left Side: Map -->
        <div class="map-section">
          <!-- Map Title Above Map -->
          <h1 class="map-title">Community Map</h1>
          
          <!-- Map Container -->
          <div ref="mapContainer" class="map-container"></div>
        </div>

        <!-- Right Side: User List Panel -->
        <div class="user-panel">
          <!-- Header Section -->
          <div class="panel-header">
            <h2 class="panel-title">Community Members</h2>
            
            <!-- Search Bar -->
            <div class="search-wrapper">
              <ion-searchbar
                v-model="searchQuery"
                placeholder="Name, interest, hobby, sports team, etc"
                class="panel-search"
                :debounce="300"
                @ionInput="handleSearch"
              ></ion-searchbar>
            </div>

            <!-- Results Count -->
            <div class="results-count">
              {{ filteredProfiles.length }} Results | {{ visibleProfilesCount }} In View
            </div>

            <!-- Message Button -->
            <ion-button
              v-if="selectedUserIds.length > 0"
              fill="solid"
              color="primary"
              class="message-button"
              @click="handleMessageSelected"
            >
              Message ({{ selectedUserIds.length }})
            </ion-button>
          </div>

          <!-- User List (only profiles currently in map viewport) -->
          <div ref="userListRef" class="user-list">
            <div
              v-for="profile in visibleInViewportProfiles"
              :key="profile.userId || profile.id"
              :ref="el => setUserCardRef(el, profile.userId || profile.id)"
              class="user-card"
              :class="{ 
                'user-card-selected': isSelected(profile),
                'user-card-highlighted': highlightedUserId === (profile.userId || profile.id)
              }"
              @click="centerMapOnUser(profile)"
            >
              <!-- Checkbox -->
              <div class="user-checkbox" @click.stop>
                <ion-checkbox
                  :checked="isSelected(profile)"
                  @ionChange="toggleSelection(profile)"
                ></ion-checkbox>
              </div>

              <!-- Avatar -->
              <div class="user-avatar">
                <img
                  v-if="profile.profilePicture"
                  :src="profile.profilePicture"
                  :alt="profile.fullName || `${profile.fname} ${profile.lname}`"
                  class="avatar-image"
                />
                <div v-else class="avatar-placeholder">
                  <ion-icon :icon="person"></ion-icon>
                </div>
              </div>

              <!-- User Info -->
              <div class="user-info">
                <h3 class="user-name">
                  {{ profile.fullName || `${profile.fname} ${profile.lname}` }}
                </h3>
                <p v-if="profile.currentLocationName" class="user-location">
                  <ion-icon :icon="locationOutline"></ion-icon>
                  {{ profile.currentLocationName }}
                </p>
                <p v-if="profile.bio" class="user-bio">{{ profile.bio }}</p>
                <div v-if="profile.interests && profile.interests.length > 0" class="user-interests">
                  <span
                    v-for="(interest, idx) in profile.interests.slice(0, 5)"
                    :key="idx"
                    class="interest-badge"
                  >
                    {{ interest }}
                  </span>
                </div>
              </div>

              <!-- Actions -->
              <div class="user-actions" @click.stop>
                <ion-button
                  fill="outline"
                  size="small"
                  class="view-profile-btn"
                  @click="viewProfileInSlack(profile)"
                >
                  View in Slack
                </ion-button>
              </div>
            </div>

            <!-- Empty State -->
            <div v-if="visibleInViewportProfiles.length === 0" class="empty-state">
              <ion-icon :icon="person" class="empty-icon"></ion-icon>
              <p v-if="filteredProfiles.length === 0">No members found</p>
              <p v-else>No members in view — pan or zoom the map to see members</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-overlay">
        <ion-spinner></ion-spinner>
        <p>Loading map...</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useCommunityStore } from '@/stores/community.store';
import { profileService, type ProfilesInit } from '@/services/profile.service';
import { communityService, type Community } from '@/services/community.service';
import { environment } from '@/environments/environment';
import { useGooglePlaces } from '@/composables/useGooglePlaces';
import { useTheme } from '@/composables/useTheme';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { slackSessionService } from '@/services/slack-session.service';
import {
  IonPage,
  IonContent,
  IonSearchbar,
  IonButton,
  IonIcon,
  IonSpinner,
  IonCheckbox,
  toastController,
  alertController,
} from '@ionic/vue';
import {
  person,
  locationOutline,
} from 'ionicons/icons';

// Google Maps types are loaded at runtime; declare to satisfy TypeScript.
declare const google: any;
const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const communityStore = useCommunityStore();
const { loadGoogleMapsScript } = useGooglePlaces();

const mapContainer = ref<HTMLElement | null>(null);
const userListRef = ref<HTMLElement | null>(null);
const isLoading = ref(false);
const searchQuery = ref('');
const profiles = ref<ProfilesInit[]>([]);
const selectedUserIds = ref<number[]>([]);
const highlightedUserId = ref<number | null>(null);
const clickedUserId = ref<number | null>(null);
const isProgrammaticMapChange = ref(false);
const map = ref<google.maps.Map | null>(null);
const markers = ref<google.maps.Marker[]>([]);
const infoWindow = ref<google.maps.InfoWindow | null>(null);
const markerClusterer = ref<MarkerClusterer | null>(null);
const markerToProfileMap = new Map<google.maps.Marker, number>();
const userIdToMarkerMap = new Map<number, google.maps.Marker>();
const userCardRefs = new Map<number, HTMLElement>();
const visibleUserIds = ref<Set<number>>(new Set());
let loadRequestId = 0;

const { isDark: isDarkMode } = useTheme();
let selectedMarkerUserId: number | null = null;

// Clustering thresholds
const CLUSTER_MIN_POINTS = 2; // cluster as soon as 2 markers are close
const CLUSTER_RADIUS = 60; // larger radius so overlap becomes a cluster sooner
// Approx 5-mile max zoom (roughly zoom level 13)
const MAP_MAX_ZOOM = 13;

const darkMapStyle: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#0b1220' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1220' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f1b2e' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#27364f' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#0b1220' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a2a3a' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#0b1220' }] },
];

/**
 * Ensure clustered markers are hidden when a cluster icon is shown.
 * This keeps the map from showing individual faces beneath a cluster count.
 */
function syncClusteredMarkerVisibility(clusters: any[] = []) {
  const processedMarkers = new Set<google.maps.Marker>();

  clusters.forEach((cluster: any) => {
    const clusterMarkers: google.maps.Marker[] = cluster?.markers || [];
    if (clusterMarkers.length >= CLUSTER_MIN_POINTS) {
      clusterMarkers.forEach((m: google.maps.Marker) => {
        m.setVisible(false);
        processedMarkers.add(m);
      });
    } else if (clusterMarkers.length === 1) {
      const m = clusterMarkers[0];
      m.setVisible(true);
      processedMarkers.add(m);
    }
  });

  // Any markers not managed by a cluster should remain visible
  markers.value.forEach((marker) => {
    if (!processedMarkers.has(marker)) {
      marker.setVisible(true);
    }
  });
}

function attachClusterVisibilityListener() {
  if (!markerClusterer.value) return;
  const handler = (event: any) => {
    const clusters = event?.clusters || (markerClusterer.value as any)?.getClusters?.() || [];
    syncClusteredMarkerVisibility(clusters);
  };
  (markerClusterer.value as any).addListener?.('clusteringend', handler);

  // Apply once immediately with current clusters if available
  if ((markerClusterer.value as any).getClusters) {
    handler({ clusters: (markerClusterer.value as any).getClusters() });
  }
}

/**
 * Returns true if the URL is cross-origin (different domain). Cross-origin images
 * will trigger CORS when drawn to canvas or used as marker icon, so we skip them
 * and use the default icon without attempting to load.
 */
function isCrossOriginImageUrl(url: string): boolean {
  if (!url || url.startsWith('data:')) return false;
  try {
    const u = new URL(url, window.location.origin);
    return u.origin !== window.location.origin;
  } catch {
    return true; // treat invalid URLs as cross-origin to avoid failed requests
  }
}

/**
 * Google Maps marker icons loaded on an HTTPS page will fail for http:// image URLs (mixed content).
 * Normalize to https when possible so avatars match what <img> can load in the main app.
 */
function normalizeMarkerImageUrl(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (/^http:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:/i, 'https:');
  }
  return trimmed;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildMapInfoWindowHtml(profile: ProfilesInit): string {
  const name = escapeHtml(profile.fullName || `${profile.fname} ${profile.lname}`);
  const bio = profile.bio ? escapeHtml(profile.bio) : '';
  const loc = profile.currentLocationName ? escapeHtml(profile.currentLocationName) : '';
  // Force readable contrast: Google injects the HTML into a light bubble; global dark-mode
  // styles can otherwise make text white-on-white. `all: initial` resets inherited color.
  return `
    <div class="trova-map-infowindow" style="all: initial; box-sizing: border-box; display: block; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 10px 12px; min-width: 220px; max-width: 280px; background: #ffffff; color: #0f172a; border-radius: 8px;">
      <div style="margin: 0 0 6px 0; font-size: 16px; font-weight: 600; color: #0f172a; line-height: 1.25;">${name}</div>
      ${bio ? `<div style="margin: 0; font-size: 14px; color: #334155; line-height: 1.35;">${bio}</div>` : ''}
      ${loc ? `<div style="margin: 8px 0 0 0; font-size: 12px; color: #64748b; line-height: 1.3;">📍 ${loc}</div>` : ''}
    </div>
  `.trim();
}

/**
 * Create a default marker icon for users without profile pictures
 */
function createDefaultMarkerIcon(): string {
  return createSleekPinSvgDataUrl({ imageUrl: null, isSelected: false, isDark: isDarkMode.value });
}

function createSleekPinSvgDataUrl(opts: { imageUrl: string | null; isSelected: boolean; isDark: boolean }): string {
  const size = opts.isSelected ? 50 : 46;
  const circle = opts.isSelected ? 24 : 22;
  const cx = size / 2;
  const cy = circle;
  const tipY = size - 2;

  const stroke = opts.isSelected ? '#fbbf24' : (opts.isDark ? '#0b1220' : '#ffffff');
  // Linear "new green" gradient (matches design reference).
  const gradStart = '#2aa876';
  const gradMid = '#34b57e';
  const gradEnd = '#42c290';

  const ring = opts.isSelected ? '#fef3c7' : `url(#pinGrad)`;
  const shadowOpacity = opts.isDark ? 0.45 : 0.18;

  const canInlineImage = Boolean(opts.imageUrl) && !isCrossOriginImageUrl(opts.imageUrl as string);
  const escapedUrl = canInlineImage
    ? (opts.imageUrl as string).replace(/&/g, '&amp;').replace(/'/g, '&apos;').replace(/"/g, '&quot;')
    : null;

  const clipId = `p${Math.random().toString(36).slice(2)}`;
  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="pinGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${gradStart}" />
      <stop offset="50%" stop-color="${gradMid}" />
      <stop offset="100%" stop-color="${gradEnd}" />
    </linearGradient>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="rgba(0,0,0,${shadowOpacity})" />
    </filter>
    <clipPath id="${clipId}">
      <circle cx="${cx}" cy="${cy}" r="${circle - 6}" />
    </clipPath>
  </defs>

  <path filter="url(#shadow)" d="
    M ${cx} ${tipY}
    C ${cx - 10} ${tipY - 14}, ${cx - 18} ${tipY - 24}, ${cx - 18} ${cy + 2}
    C ${cx - 18} ${cy - 10}, ${cx - 8} ${cy - 18}, ${cx} ${cy - 18}
    C ${cx + 8} ${cy - 18}, ${cx + 18} ${cy - 10}, ${cx + 18} ${cy + 2}
    C ${cx + 18} ${tipY - 24}, ${cx + 10} ${tipY - 14}, ${cx} ${tipY}
    Z
  " fill="${ring}" />

  <circle cx="${cx}" cy="${cy}" r="${circle - 4}" fill="${stroke}" />
  <circle cx="${cx}" cy="${cy}" r="${circle - 6}" fill="${opts.isDark ? '#111827' : '#f8fafc'}" />

  ${
    escapedUrl
      ? `<image href="${escapedUrl}" xlink:href="${escapedUrl}" x="${cx - (circle - 6)}" y="${cy - (circle - 6)}" width="${(circle - 6) * 2}" height="${(circle - 6) * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />`
      : `
        <g transform="translate(${cx}, ${cy})">
          <circle cx="0" cy="-4" r="6" fill="${opts.isDark ? '#e2e8f0' : '#ffffff'}" opacity="0.95" />
          <path d="M -11 14 C -8 4, 8 4, 11 14 Z" fill="${opts.isDark ? '#e2e8f0' : '#ffffff'}" opacity="0.95" />
        </g>
      `
  }
</svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Slightly spread markers that share identical coordinates to avoid perfect overlap.
 */
function buildJitteredPositions(profilesList: ProfilesInit[]): Map<number, { lat: number; lng: number }> {
  const grouped = new Map<string, ProfilesInit[]>();
  const positions = new Map<number, { lat: number; lng: number }>();

  profilesList.forEach((profile) => {
    if (!profile.currentLat || !profile.currentLong) return;
    const key = `${profile.currentLat.toFixed(5)}_${profile.currentLong.toFixed(5)}`;
    const list = grouped.get(key) || [];
    list.push(profile);
    grouped.set(key, list);
  });

  grouped.forEach((group) => {
    const size = group.length;
    if (size === 1) {
      const p = group[0];
      positions.set(p.userId || p.id, { lat: p.currentLat!, lng: p.currentLong! });
      return;
    }

    // Spread radius scales with group size for clearer separation without exploding the map
    // Base 360m, +60m per extra user, capped to 840m (triple the prior spread)
    const radiusMeters = Math.min(360 + (size - 1) * 60, 840);
    group.forEach((p, idx) => {
      const angle = (2 * Math.PI * idx) / size;
      const baseLat = p.currentLat!;
      const baseLng = p.currentLong!;
      const latOffset = (radiusMeters / 111320) * Math.sin(angle);
      const lngOffset =
        (radiusMeters / (111320 * Math.cos((baseLat * Math.PI) / 180))) * Math.cos(angle);
      positions.set(p.userId || p.id, { lat: baseLat + latOffset, lng: baseLng + lngOffset });
    });
  });

  return positions;
}

/**
 * Create a circular version of an image using canvas
 */
function createCircularImage(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeout = setTimeout(() => {
      reject(new Error('Image load timeout'));
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const size = 40;
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0, size, size);
        
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load image for canvas'));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Try to create circular image without CORS (for same-origin or CORS-enabled images)
 */
function createCircularImageWithoutCORS(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Don't set crossOrigin - this works for same-origin or properly configured CORS
    
    const timeout = setTimeout(() => {
      reject(new Error('Image load timeout'));
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const size = 40;
        canvas.width = size;
        canvas.height = size;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0, size, size);
        
        resolve(canvas.toDataURL('image/png'));
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Create a circular masked image using SVG with clipPath (works better than mask for Google Maps)
 */
function createCircularMaskedImage(imageUrl: string): string {
  // Create an SVG with a circular clipPath
  // clipPath works more reliably than mask for Google Maps markers
  const uniqueId = `circleClip${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Properly escape the image URL for use in SVG
  const escapedUrl = imageUrl.replace(/&/g, '&amp;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
  
  const svg = `<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<defs>
  <clipPath id="${uniqueId}">
    <circle cx="20" cy="20" r="20"/>
  </clipPath>
</defs>
<image href="${escapedUrl}" xlink:href="${escapedUrl}" x="0" y="0" width="40" height="40" clip-path="url(#${uniqueId})" preserveAspectRatio="xMidYMid slice"/>
</svg>`.trim();
  
  // Convert SVG to data URL with URI encoding
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Create a custom cluster renderer with clean, modern styling
 * Single color scheme - no color variations based on count
 * Shows count of markers visible in current viewport, not total cluster count
 */
function createClusterRenderer() {
  return {
    render: (cluster: any) => {
      const clusterMarkers = cluster.markers || [];
      
      // Count only markers that are visible in the current viewport
      let visibleCount = clusterMarkers.length;
      if (map.value) {
        const bounds = map.value.getBounds();
        if (bounds) {
          visibleCount = clusterMarkers.filter((marker: google.maps.Marker) => {
            const position = marker.getPosition();
            return position ? bounds.contains(position) : false;
          }).length;
        }
      }
      
      // If all markers are visible and we're zoomed in, show count as 0 to indicate
      // individual markers should be visible (algorithm should handle this with maxZoom)
      // But for now, just use visible count
      const displayCount = visibleCount > 0 ? visibleCount : cluster.count;
      
      // Calculate size based on display count (subtle scaling)
      const size = Math.min(50 + Math.sqrt(displayCount) * 2, 70);
      const radius = size / 2;
      
      // Create canvas for cluster icon
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        return new (window as any).google.maps.Marker({
          position: cluster.position,
          label: { text: String(displayCount), color: 'white' },
        });
      }
      
      // Clean, modern design - linear green gradient
      ctx.beginPath();
      ctx.arc(radius, radius, radius - 1, 0, Math.PI * 2);
      const grad = ctx.createLinearGradient(0, 0, size, 0);
      grad.addColorStop(0, '#2aa876');
      grad.addColorStop(0.5, '#34b57e');
      grad.addColorStop(1, '#42c290');
      ctx.fillStyle = grad;
      ctx.fill();
      
      // White text
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.min(13 + Math.floor(displayCount / 20), 16)}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(displayCount), radius, radius);
      
      // Convert canvas to data URL
      const iconUrl = canvas.toDataURL();
      
      const clusterMarker = new (window as any).google.maps.Marker({
        position: cluster.position,
        icon: {
          url: iconUrl,
          scaledSize: new (window as any).google.maps.Size(size, size),
          anchor: new (window as any).google.maps.Point(radius, radius),
        },
        zIndex: Number((window as any).google.maps.Marker.MAX_ZINDEX) + displayCount,
      });
      
      // Add click handler to expand cluster
      clusterMarker.addListener('click', () => {
        expandCluster(clusterMarkers);
      });
      
      return clusterMarker;
    },
  };
}

/**
 * Expand a cluster by zooming in and centering on it
 * Shows all users in a circle around the center with max zoom of ~1 mile
 */
function expandCluster(markers: google.maps.Marker[]) {
  if (!map.value || !markers || markers.length === 0) return;
  
  // Calculate bounds for all markers in the cluster
  const bounds = new (window as any).google.maps.LatLngBounds();
  markers.forEach((marker: google.maps.Marker) => {
    const position = marker.getPosition();
    if (position) {
      bounds.extend(position);
    }
  });
  
  // Get the center of the cluster
  const center = bounds.getCenter();
  
  // Calculate the distance from center to the farthest marker
  let maxDistance = 0;
  markers.forEach((marker: google.maps.Marker) => {
    const position = marker.getPosition();
    if (position) {
      const distance = calculateDistance(
        center.lat(),
        center.lng(),
        position.lat(),
        position.lng()
      );
      maxDistance = Math.max(maxDistance, distance);
    }
  });
  
  // Ensure minimum radius of ~0.5 miles (to show users in a circle)
  // and maximum of ~1 mile (max zoom constraint)
  const minRadiusMiles = 0.5;
  const maxRadiusMiles = 1.0;
  const radiusMiles = Math.max(minRadiusMiles, Math.min(maxDistance * 1.5, maxRadiusMiles));
  
  // Convert miles to degrees (approximate, works well for small distances)
  // 1 degree latitude ≈ 69 miles
  // 1 degree longitude ≈ 69 miles * cos(latitude)
  const latRadius = radiusMiles / 69;
  const lngRadius = radiusMiles / (69 * Math.cos(center.lat() * Math.PI / 180));
  
  // Create a circular bounds around the center
  const expandedBounds = new (window as any).google.maps.LatLngBounds();
  expandedBounds.extend(new (window as any).google.maps.LatLng(
    center.lat() + latRadius,
    center.lng() + lngRadius
  ));
  expandedBounds.extend(new (window as any).google.maps.LatLng(
    center.lat() - latRadius,
    center.lng() - lngRadius
  ));
  
  // Fit bounds with padding to show all users in a circle
  map.value.fitBounds(expandedBounds, { padding: 80 });
  
  // Set max zoom level (approximately 1 mile view) after fitBounds completes
  // Zoom level 13-14 typically shows about 1 mile
  // The cluster algorithm has maxZoom: 15, so clusters will break apart when zoomed in enough
  setTimeout(() => {
    if (map.value) {
      const currentZoom = map.value.getZoom();
      if (currentZoom && currentZoom > MAP_MAX_ZOOM) {
        map.value.setZoom(MAP_MAX_ZOOM);
      }
    }
  }, 100);
  
  // Note: Cluster refresh is handled by the zoom_changed and idle listeners
  // No need to add another listener here to avoid infinite loops
}

/**
 * Calculate distance between two lat/lng points in miles using Haversine formula
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Show marker info window and highlight user in list
 */
async function showMarkerInfo(marker: google.maps.Marker, profile: ProfilesInit, userId: number) {
  if (!map.value || !infoWindow.value) return;
  const targetMarker = userIdToMarkerMap.get(userId) || marker;
  
  // Get the latest profile data from filteredProfiles to ensure we have the most current image URL
  // This ensures the marker icon matches what's shown in the list
  const latestProfile = filteredProfiles.value.find(p => (p.userId || p.id) === userId) || profile;
  
  selectedMarkerUserId = userId;
  await updateMarkerIcon(targetMarker, latestProfile);

  infoWindow.value.setContent(buildMapInfoWindowHtml(latestProfile));
  // Keep the clicked marker on top when multiple users share a location
  bringMarkerToFront(targetMarker);
  infoWindow.value.open(map.value, targetMarker);
  
  // Set clicked user to move them to top of list
  clickedUserId.value = userId;
  
  // Highlight corresponding user in list
  highlightUserInList(userId);
}

/**
 * Get center point of all profiles
 */
function getCenterOfProfiles(): { lat: number; lng: number } {
  const defaultCenter = { lat: 37.7749, lng: -122.4194 };
  
  if (!profiles.value || profiles.value.length === 0) {
    return defaultCenter;
  }

  let runningCount = 0;
  let runningLat = 0;
  let runningLong = 0;

  for (const profile of profiles.value) {
    if (!profile.currentLat || !profile.currentLong) {
      continue;
    }
    runningLat += profile.currentLat;
    runningLong += profile.currentLong;
    runningCount++;
  }

  if (runningCount === 0) {
    return defaultCenter;
  }

  return {
    lat: runningLat / runningCount,
    lng: runningLong / runningCount,
  };
}

const filteredProfiles = computed(() => {
  let filtered = profiles.value;

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(profile => {
      const name = `${profile.fname} ${profile.lname}`.toLowerCase();
      const bio = profile.bio?.toLowerCase() || '';
      const interests = profile.interests?.join(' ').toLowerCase() || '';
      const locationName = profile.currentLocationName?.toLowerCase() || '';
      
      return name.includes(query) || 
             bio.includes(query) || 
             interests.includes(query) || 
             locationName.includes(query);
    });
  }

  // Sort: clicked user first, then alphabetically
  if (clickedUserId.value !== null) {
    filtered = [...filtered].sort((a, b) => {
      const aId = a.userId || a.id;
      const bId = b.userId || b.id;
      
      // Clicked user always first
      if (aId === clickedUserId.value) return -1;
      if (bId === clickedUserId.value) return 1;
      
      // Then alphabetically
      const nameA = (a.fullName || `${a.fname} ${a.lname}`).toLowerCase();
      const nameB = (b.fullName || `${b.fname} ${b.lname}`).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  } else {
    // Just sort alphabetically if no clicked user
    filtered = [...filtered].sort((a, b) => {
      const nameA = (a.fullName || `${a.fname} ${a.lname}`).toLowerCase();
      const nameB = (b.fullName || `${b.fname} ${b.lname}`).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }

  return filtered;
});

// Profiles visible in the current map viewport (sidebar list refreshes with map pan/zoom)
const visibleInViewportProfiles = computed(() => {
  const visible = filteredProfiles.value.filter(profile => {
    const userId = profile.userId || profile.id;
    return visibleUserIds.value.has(userId);
  });

  // Sort: clicked user first (if any), then alphabetically
  if (clickedUserId.value !== null) {
    return [...visible].sort((a, b) => {
      const aId = a.userId || a.id;
      const bId = b.userId || b.id;
      if (aId === clickedUserId.value) return -1;
      if (bId === clickedUserId.value) return 1;
      const nameA = (a.fullName || `${a.fname} ${a.lname}`).toLowerCase();
      const nameB = (b.fullName || `${b.fname} ${b.lname}`).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }
  return visible.sort((a, b) => {
    const nameA = (a.fullName || `${a.fname} ${a.lname}`).toLowerCase();
    const nameB = (b.fullName || `${b.fname} ${b.lname}`).toLowerCase();
    return nameA.localeCompare(nameB);
  });
});

// Count of profiles visible on map (with valid coordinates)
const visibleProfilesCount = computed(() => {
  return visibleInViewportProfiles.value.length;
});

function isSelected(profile: ProfilesInit): boolean {
  const userId = profile.userId || profile.id;
  return selectedUserIds.value.includes(userId);
}

function toggleSelection(profile: ProfilesInit) {
  const userId = profile.userId || profile.id;
  const index = selectedUserIds.value.indexOf(userId);
  if (index > -1) {
    selectedUserIds.value.splice(index, 1);
  } else {
    selectedUserIds.value.push(userId);
  }
}

/**
 * Set user card ref for scrolling/highlighting
 */
function setUserCardRef(el: any, userId: number) {
  if (el == null) {
    userCardRefs.delete(userId);
    return;
  }
  if (el instanceof HTMLElement) {
    userCardRefs.set(userId, el);
  } else if ('$el' in el && el.$el instanceof HTMLElement) {
    userCardRefs.set(userId, el.$el);
  }
}

/**
 * Highlight user card in list and scroll it into view
 */
function highlightUserInList(userId: number) {
  highlightedUserId.value = userId;
  
  // Scroll to the user card
  const cardElement = userCardRefs.get(userId);
  if (cardElement && userListRef.value) {
    // Bring the list to the top first so the card is fully visible
    userListRef.value.scrollTo({ top: 0, behavior: 'smooth' });
    // Then ensure the specific card is centered
    setTimeout(() => {
      cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }
  
  // Highlight persists until another user is clicked or view changes
  // No automatic timeout - user stays highlighted
}

function bringMarkerToFront(marker: google.maps.Marker) {
  const baseZ = (window as any)?.google?.maps?.Marker?.MAX_ZINDEX ?? 100000;
  marker.setZIndex(baseZ + 50);
}

/**
 * Update a marker's icon to match the current profile picture.
 * Uses profile picture URL directly; CSS makes marker images circular.
 */
async function updateMarkerIcon(marker: google.maps.Marker, profile: ProfilesInit) {
  const userId = profile.userId || profile.id;
  const isSelected = selectedMarkerUserId != null && userId === selectedMarkerUserId;

  // Use the raw image URL for avatars (this is how the map behaved pre-dark-mode changes and
  // is the most reliable path across browsers/CORS). The gradient "pin" is used for defaults.
  const picUrl = normalizeMarkerImageUrl(profile.profilePicture);
  if (picUrl) {
    const px = isSelected ? 50 : 46;
    marker.setIcon({
      url: picUrl,
      scaledSize: new google.maps.Size(px, px),
      anchor: new google.maps.Point(px / 2, px / 2),
    });
    return;
  }

  const markerIcon = createSleekPinSvgDataUrl({
    imageUrl: profile.profilePicture || null,
    isSelected,
    isDark: isDarkMode.value,
  });
  const px = isSelected ? 50 : 46;
  marker.setIcon({
    url: markerIcon,
    scaledSize: new google.maps.Size(px, px),
    anchor: new google.maps.Point(px / 2, px - 2),
  });
}

/**
 * Center map on user's marker
 */
async function centerMapOnUser(profile: ProfilesInit) {
  const userId = profile.userId || profile.id;
  
  if (!profile.currentLat || !profile.currentLong || !map.value) {
    return;
  }
  
  // Set clicked user to move them to top of list
  clickedUserId.value = userId;
  
  // Highlight user in list and scroll into view
  highlightUserInList(userId);
  
  // Find the marker for this user
  const userMarker = userIdToMarkerMap.get(userId);
  
  if (userMarker) {
    // Get the latest profile data from filteredProfiles to ensure we have the most current image URL
    // This ensures the marker icon matches what's shown in the list
    const latestProfile = filteredProfiles.value.find(p => (p.userId || p.id) === userId) || profile;
    
    selectedMarkerUserId = userId;
    await updateMarkerIcon(userMarker, latestProfile);
    bringMarkerToFront(userMarker);
    
    const position = userMarker.getPosition();
    if (position) {
      // Mark as programmatic change to prevent clearing highlight
      isProgrammaticMapChange.value = true;
      map.value.setCenter(position);
      map.value.setZoom(MAP_MAX_ZOOM);
      
      // Reset flag after map settles
      setTimeout(() => {
        isProgrammaticMapChange.value = false;
      }, 500);
      
      // Open info window
      if (infoWindow.value) {
        infoWindow.value.setContent(buildMapInfoWindowHtml(latestProfile));
        infoWindow.value.open(map.value, userMarker);
      }
    }
  }
}

function handleMessageSelected() {
  if (selectedUserIds.value.length === 1) {
    router.push(`/tabs/messages?userId=${selectedUserIds.value[0]}`);
  }
}

/**
 * Extract communityId from URL query parameters and set it in the store
 * This handles Slack links that include communityId in the URL
 * Should only run once on initial load, not on every profile reload
 */
let communityWatchSetup = false;
let hasExtractedFromUrl = false;
async function extractAndSetCommunityFromUrl() {
  // Only extract from URL once on initial load
  // Don't override user's manual community selection
  if (hasExtractedFromUrl) {
    return false;
  }
  const params = route.query;
  const urlCommunityId = params.communityId;
  
  if (urlCommunityId) {
    const communityIdNum = Number(urlCommunityId);
    if (!isNaN(communityIdNum)) {
      // Check if this community exists in the store
      const community = communityStore.getCommunityById(communityIdNum);
      if (community) {
        communityStore.setCurrentCommunity(community);
        hasExtractedFromUrl = true;
        return true; // Successfully set
      } else {
        // Community not in store yet - for Slack link users we may not have user ID so communities never load.
        // Set a minimal community from URL so loadProfiles can run with this communityId.
        const params = route.query;
        const hasSlackLinkParams = params.s && params.communityId && params.slackUserId;
        if (hasSlackLinkParams) {
          const name = typeof params.communityName === 'string'
            ? decodeURIComponent(params.communityName.replace(/\+/g, ' '))
            : `Community ${communityIdNum}`;
          const minimalCommunity: Community = {
            id: communityIdNum,
            name,
            leaderId: 0,
          };
          communityStore.setCommunities([minimalCommunity]);
          communityStore.setCurrentCommunity(minimalCommunity);
          hasExtractedFromUrl = true;
          return true;
        }
        if (!communityWatchSetup) {
          communityWatchSetup = true;
          if (communityStore.communities.length > 0) {
            const foundCommunity = communityStore.getCommunityById(communityIdNum);
            if (foundCommunity) {
              communityStore.setCurrentCommunity(foundCommunity);
              hasExtractedFromUrl = true;
              communityWatchSetup = false;
              return true;
            }
          }
          const unwatch = watch(() => communityStore.communities, (communities) => {
            if (communities.length > 0) {
              const foundCommunity = communityStore.getCommunityById(communityIdNum);
              if (foundCommunity) {
                communityStore.setCurrentCommunity(foundCommunity);
                hasExtractedFromUrl = true;
                unwatch();
                communityWatchSetup = false;
              }
            }
          }, { immediate: true });
        }
        return false;
      }
    }
  }
  return false;
}

/**
 * Show alert when Slack session expires with options to auth in or go back to Slack
 */
async function showSlackSessionExpiredAlert() {
  const alert = await alertController.create({
    header: 'Session Expired',
    message: 'For security purposes, your session has expired after 60 seconds. Would you like to sign in to continue, or go back to Slack to create a new session?',
    buttons: [
      {
        text: 'Go Back to Slack',
        role: 'cancel',
        handler: () => {
          const slackTeamId = (route.query.slackTeamId as string) || '';
          const slackAppId = environment.slackAppId;

          // Prefer a deterministic Slack deep link over history.back() (which often doesn't work
          // when the browser tab wasn't actually navigated from Slack).
          if (slackTeamId && slackAppId) {
            window.location.href = `slack://app?team=${slackTeamId}&id=${slackAppId}&tab=home`;
            return;
          }

          // Fallback: open Slack (best-effort) and also try browser history.
          window.location.href = 'slack://open';
          setTimeout(() => {
            window.history.back();
          }, 250);
        }
      },
      {
        text: 'Sign In',
        handler: () => {
          router.push('/login');
        }
      }
    ]
  });
  await alert.present();
}

async function loadProfiles() {
  const thisRequest = ++loadRequestId;
  isLoading.value = true;
  try {
    const communityId = communityStore.currentCommunityId;
    if (!communityId) {
      if (thisRequest === loadRequestId) profiles.value = [];
      return;
    }
    
    const urlSecretId = (route.query.s as string) || '';
    const slackUserIdFromUrl = (route.query.slackUserId as string) || '';
    let secretIdToSend: string | undefined = undefined;

    // Check if user is fully authenticated (has Firebase auth + user profile)
    const isFullyAuthenticated = authStore.isAuthenticated && authStore.user?.id;

    if (urlSecretId && !isFullyAuthenticated && communityId && slackUserIdFromUrl) {
      slackSessionService.setValidatedContext(urlSecretId, communityId, slackUserIdFromUrl);
    }

    if (urlSecretId && !isFullyAuthenticated) {
      if (slackSessionService.isSessionExpired()) {
        await showSlackSessionExpiredAlert();
        if (thisRequest === loadRequestId) profiles.value = [];
        return;
      }

      // Always send the secret so the backend can identify the caller.
      // The "validated" flag only tracks whether the initial handshake passed;
      // the backend still needs `s` on every request for Slack-only users.
      secretIdToSend = urlSecretId;
    } else if (isFullyAuthenticated) {
      secretIdToSend = undefined;
    }
    
    const fetchedProfiles = await profileService.getProfilesForUserAndCommunity(
      communityId,
      secretIdToSend
    );
    
    // A newer request was fired while we were awaiting — discard this result silently.
    if (thisRequest !== loadRequestId) return;
    
    profiles.value = fetchedProfiles.filter(profile => {
      return profile.currentLat !== undefined && 
             profile.currentLat !== null && 
             profile.currentLong !== undefined && 
             profile.currentLong !== null &&
             !isNaN(profile.currentLat) && 
             !isNaN(profile.currentLong);
    });
    await updateMapMarkers({ fitBounds: true });
  } catch (error: any) {
    // Stale request — a newer one is in flight, so don't touch state or show errors.
    if (thisRequest !== loadRequestId) return;

    console.error('[MapPage] Error loading profiles:', error?.message ?? error);
    
    const errorMessage = error.message || error.response?.data?.message || '';
    const status = error.status || error.response?.status;
    
    if ((status === 401 || errorMessage.toLowerCase().includes('expired') || errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('secret')) 
        && slackSessionService.isSlackLinkUser()) {
      await showSlackSessionExpiredAlert();
    } else {
      const toast = await toastController.create({
        message: errorMessage || 'Failed to load map data. Please try again.',
        duration: 4000,
        color: 'danger',
      });
      await toast.present();
    }
    
    profiles.value = [];
  } finally {
    if (thisRequest === loadRequestId) isLoading.value = false;
  }
}

/**
 * Refresh clusters to update visible counts based on current viewport
 * Uses a debounce to avoid excessive re-rendering, but refreshes immediately on zoom
 * Includes a guard to prevent infinite loops
 */
let clusterRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
let isRefreshing = false;
function refreshClusters(immediate = false) {
  if (!markerClusterer.value || !map.value || isRefreshing) return;
  
  // If immediate (zoom change) or no pending refresh, execute right away
  if (immediate || !clusterRefreshTimeout) {
    if (clusterRefreshTimeout) {
      clearTimeout(clusterRefreshTimeout);
      clusterRefreshTimeout = null;
    }
    
    isRefreshing = true;
    try {
      // Force MarkerClusterer to re-evaluate clusters by clearing and re-adding markers
      // This triggers the algorithm to re-run and the renderer to be called with fresh data
      const currentMarkers = [...markers.value]; // Create a copy to avoid reference issues
      if (currentMarkers.length > 0 && markerClusterer.value) {
        // Remove and re-add markers to trigger cluster re-rendering
        // This forces the algorithm to re-evaluate based on current zoom/bounds
        markerClusterer.value.clearMarkers();
        // Small delay to ensure clear completes before re-adding
        setTimeout(() => {
          if (markerClusterer.value && currentMarkers.length > 0) {
            markerClusterer.value.addMarkers(currentMarkers);
          }
          isRefreshing = false;
        }, 50);
      } else {
        isRefreshing = false;
      }
        } catch {
      isRefreshing = false;
    }
  } else {
    // Debounce for non-immediate refreshes (panning)
    if (clusterRefreshTimeout) {
      clearTimeout(clusterRefreshTimeout);
    }
    
    clusterRefreshTimeout = setTimeout(() => {
      if (!markerClusterer.value || isRefreshing) return;
      
      isRefreshing = true;
      try {
        const currentMarkers = [...markers.value]; // Create a copy to avoid reference issues
        if (currentMarkers.length > 0 && markerClusterer.value) {
          markerClusterer.value.clearMarkers();
          setTimeout(() => {
            if (markerClusterer.value && currentMarkers.length > 0) {
              markerClusterer.value.addMarkers(currentMarkers);
            }
            isRefreshing = false;
          }, 50);
        } else {
          isRefreshing = false;
        }
      } catch {
        isRefreshing = false;
      }
    }, 150); // Shorter debounce for better responsiveness
  }
}

/**
 * Update visible user IDs based on current map bounds
 */
function updateVisibleUsers() {
  if (!map.value) {
    visibleUserIds.value.clear();
    // Reset clicked user when view changes
    clickedUserId.value = null;
    return;
  }
  
  const bounds = map.value.getBounds();
  if (!bounds) {
    visibleUserIds.value.clear();
    // Reset clicked user when view changes
    clickedUserId.value = null;
    return;
  }
  
  // Reset clicked user and highlight when view changes (but not during programmatic changes)
  // Only clear if this is a user-initiated view change, not programmatic
  if (!isProgrammaticMapChange.value) {
    clickedUserId.value = null;
    highlightedUserId.value = null;
  }
  
  const newVisibleIds = new Set<number>();
  
  // Check each marker to see if it's within bounds
  // The markers array contains all markers, whether clustered or not
  markers.value.forEach((marker: google.maps.Marker) => {
    const position = marker.getPosition();
    if (position) {
      // Check if marker position is within the current map bounds
      if (bounds.contains(position)) {
        const userId = markerToProfileMap.get(marker);
        if (userId) {
          newVisibleIds.add(userId);
        }
      }
    }
  });
  
  // Also check profiles directly by their coordinates
  // This ensures we catch all users even if marker tracking has issues
  filteredProfiles.value.forEach((profile) => {
    if (profile.currentLat && profile.currentLong) {
      const profilePosition = new (window as any).google.maps.LatLng(
        profile.currentLat,
        profile.currentLong
      );
      if (bounds.contains(profilePosition)) {
        const userId = profile.userId || profile.id;
        newVisibleIds.add(userId);
      }
    }
  });
  
  visibleUserIds.value = newVisibleIds;
}

async function initializeMap() {
  if (!mapContainer.value) return;

  try {
    await loadGoogleMapsScript();

    if (!(window as any).google?.maps) {
      throw new Error('Google Maps not loaded');
    }

    // Only set center if we have profiles, otherwise use a neutral world view
    // The center will be updated when markers are added
    const center = profiles.value.length > 0 
      ? getCenterOfProfiles() 
      : { lat: 39.8283, lng: -98.5795 }; // Center of USA - more neutral than SF
    
    map.value = new google.maps.Map(mapContainer.value, {
      center: center,
      zoom: profiles.value.length > 0 ? 10 : 4, // Wider view if no profiles yet
      maxZoom: MAP_MAX_ZOOM,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      styles: isDarkMode.value ? darkMapStyle : undefined,
    });

    infoWindow.value = new google.maps.InfoWindow();
    
    // Add listener for map bounds changes to update visible users
    map.value.addListener('bounds_changed', () => {
      updateVisibleUsers();
    });
    
    // Note: Removed refreshClusters calls as they were causing stack overflow
    // The algorithm's maxZoom setting should handle cluster breaking naturally
    // Add listener for idle event (after pan/zoom completes)
    map.value.addListener('idle', () => {
      updateVisibleUsers();
    });
    
    await updateMapMarkers({ fitBounds: false });
    // Update visible users after markers are created
    updateVisibleUsers();
  } catch (error) {
    console.error('[MapPage] Error initializing map:', error instanceof Error ? error.message : error);
  }
}

/**
 * Rebuild markers from filteredProfiles. Only pass fitBounds: true when loading community
 * data (loadProfiles) — search/filter changes should not reset pan/zoom.
 */
async function updateMapMarkers(options?: { fitBounds?: boolean }) {
  const fitBounds = options?.fitBounds === true;
  if (!map.value) return;

  // Clear existing markers and clusterer
  if (markerClusterer.value) {
    markerClusterer.value.clearMarkers();
    markerClusterer.value = null;
  }
  
  markers.value.forEach(marker => marker.setMap(null));
  markers.value = [];
  markerToProfileMap.clear();
  userIdToMarkerMap.clear();

  const newMarkers: google.maps.Marker[] = [];
  const jitteredPositions = buildJitteredPositions(filteredProfiles.value);

  for (const profile of filteredProfiles.value) {
    if (!profile.currentLat || !profile.currentLong) {
      continue;
    }

    const jitter = jitteredPositions.get(profile.userId || profile.id);
    const coords = jitter ?? { lat: profile.currentLat, lng: profile.currentLong };
    
    const userId = profile.userId || profile.id;
    const isSelected = selectedMarkerUserId != null && userId === selectedMarkerUserId;
    const px = isSelected ? 50 : 46;

    // See updateMarkerIcon(): use direct URL icons for avatars.
    const picUrl = normalizeMarkerImageUrl(profile.profilePicture);
    const markerIcon = picUrl
      ? picUrl
      : createSleekPinSvgDataUrl({
          imageUrl: null,
          isSelected,
          isDark: isDarkMode.value,
        });
    const marker = new google.maps.Marker({
      position: coords,
      title: profile.fullName || `${profile.fname} ${profile.lname}`,
      icon: {
        url: markerIcon,
        scaledSize: new google.maps.Size(px, px),
        anchor:
          picUrl
            ? new google.maps.Point(px / 2, px / 2)
            : new google.maps.Point(px / 2, px - 2),
      },
      optimized: false,
    });

    // Store mapping between marker and profile
    markerToProfileMap.set(marker, userId);
    userIdToMarkerMap.set(userId, marker);

    marker.addListener('click', () => {
      // Always show info - if in cluster, user can click cluster to expand
      showMarkerInfo(marker, profile, userId);
    });

    newMarkers.push(marker);
    markers.value.push(marker);
  }

  if (newMarkers.length > 0 && map.value) {
    try {
      // Import SuperClusterAlgorithm from the main package
      const { SuperClusterAlgorithm } = await import('@googlemaps/markerclusterer');
      
      markerClusterer.value = new MarkerClusterer({
        map: map.value,
        markers: newMarkers,
        algorithm: new SuperClusterAlgorithm({ 
          radius: CLUSTER_RADIUS,
          minPoints: CLUSTER_MIN_POINTS,
          maxZoom: MAP_MAX_ZOOM // Cap zoom so we don't go closer than ~5 miles
        }),
        renderer: createClusterRenderer(),
      });
    } catch (error) {
      // Fallback to default if algorithm import fails
      console.warn('[MapPage] Could not load SuperClusterAlgorithm, using default:', error);
      markerClusterer.value = new MarkerClusterer({
        map: map.value,
        markers: newMarkers,
        renderer: createClusterRenderer(),
      });
    }

    attachClusterVisibilityListener();

    if (fitBounds) {
      // Adjust map bounds to show all markers (initial / community load only)
      const bounds = new (window as any).google.maps.LatLngBounds();
      newMarkers.forEach((marker: google.maps.Marker) => {
        const position = marker.getPosition();
        if (position) {
          bounds.extend(position);
        }
      });

      if (newMarkers.length > 1) {
        map.value.fitBounds(bounds, { padding: 50 });
        setTimeout(() => {
          if (map.value && map.value.getZoom() && map.value.getZoom()! > MAP_MAX_ZOOM) {
            map.value.setZoom(MAP_MAX_ZOOM);
          }
        }, 150);
      } else if (newMarkers.length === 1) {
        const position = newMarkers[0].getPosition();
        if (position) {
          map.value.setCenter(position);
          map.value.setZoom(Math.min(12, MAP_MAX_ZOOM));
        }
      }
    }

    // Update visible users after markers are added and map has settled
    setTimeout(() => {
      updateVisibleUsers();
    }, 500);
  } else {
    // No markers (e.g. search matched nobody). Only recenter on full data loads, not search.
    if (fitBounds && profiles.value.length > 0) {
      const center = getCenterOfProfiles();
      map.value.setCenter(center);
      map.value.setZoom(10);
    }
    visibleUserIds.value.clear();
  }
}

async function handleSearch() {
  await updateMapMarkers();
}

function viewProfile(userId: number) {
  router.push(`/tabs/profile/${userId}`);
}

/**
 * "View in Slack": match Ionic. Fire POST (fire-and-forget), then immediately open Trova's Slack app.
 * POST /public/slack/publishViewProfileFromMap with { userSlackId, otherUserSlackId };
 * then slack://app?team=<team>&id=<trovaSlackAppId>&tab=home. No user id in link; do not wait for POST.
 */
function viewProfileInSlack(profile: ProfilesInit) {
  const viewerSlackId = (route.query.slackUserId as string) || (authStore.user as any)?.slackId;
  const otherUserSlackId = profile.slackId;
  const slackTeamId = (route.query.slackTeamId as string) || '';
  const slackAppId = environment.slackAppId;

  if (!otherUserSlackId && import.meta.env.DEV) {
    console.warn('[ViewInSlack] profile.slackId is missing');
  }
  if (viewerSlackId && otherUserSlackId) {
    communityService.viewSlackProfileFromMap(viewerSlackId, otherUserSlackId);
  }
  if (slackTeamId && slackAppId) {
    window.location.href = `slack://app?team=${slackTeamId}&id=${slackAppId}&tab=home`;
  } else {
    window.location.href = 'slack://open';
  }
}

watch(() => communityStore.currentCommunityId, (newCommunityId) => {
  if (newCommunityId) {
    loadProfiles();
  }
});

onMounted(async () => {
  await nextTick();
  // Try to extract and set community from URL first (for Slack links)
  await extractAndSetCommunityFromUrl();
  await initializeMap();
  await loadProfiles();
});

onUnmounted(() => {
  if (markerClusterer.value) {
    markerClusterer.value.clearMarkers();
    markerClusterer.value = null;
  }
  markers.value.forEach((marker: google.maps.Marker) => marker.setMap(null));
  markers.value = [];
  markerToProfileMap.clear();
  userCardRefs.clear();
});

watch(
  () => isDarkMode.value,
  () => {
    if (map.value) {
      map.value.setOptions({ styles: isDarkMode.value ? darkMapStyle : undefined });
    }
    markers.value.forEach((m) => {
      const userId = markerToProfileMap.get(m);
      if (!userId) return;
      const profile = filteredProfiles.value.find((p) => (p.userId || p.id) === userId);
      if (profile) {
        updateMarkerIcon(m, profile);
      }
    });
  },
);
</script>

<style scoped>
.map-content {
  --background: var(--ion-background-color);
  height: 100%;
  overflow: hidden;
}

.map-layout {
  display: flex;
  height: 100%;
  width: 100%;
  padding: 108px 24px 72px;
  box-sizing: border-box;
  gap: 20px;
}

/* Map Section (Left) */
.map-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--ion-box-shadow);
  background: var(--ion-card-background);
}

.map-title {
  margin: 0;
  padding: 16px 20px;
  font-size: 24px;
  font-weight: 600;
  color: var(--ion-text-color);
  border-bottom: 1px solid var(--ion-border-color);
  flex-shrink: 0;
}

.map-container {
  width: 100%;
  flex: 1;
  min-height: 0;
}

/* User Panel (Right) */
.user-panel {
  width: 400px;
  background: var(--ion-card-background);
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  box-shadow: var(--ion-box-shadow);
  overflow: hidden;
}

.panel-header {
  padding: 20px;
  border-bottom: 1px solid var(--ion-border-color);
  background: var(--ion-card-background);
  flex-shrink: 0;
}

.panel-title {
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.search-wrapper {
  margin-bottom: 12px;
}

.panel-search {
  --background: color-mix(in srgb, var(--ion-card-background) 75%, var(--ion-text-color) 5%);
  --box-shadow: none;
  --border-radius: 8px;
  --placeholder-color: color-mix(in srgb, var(--ion-text-color) 55%, transparent);
  padding: 0;
}

.results-count {
  font-size: 14px;
  color: color-mix(in srgb, var(--ion-text-color) 60%, transparent);
  margin-bottom: 12px;
}

.message-button {
  width: 100%;
  --border-radius: 8px;
  font-weight: 500;
  margin-top: 8px;
}

.user-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.user-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 12px;
  border: 1px solid var(--ion-border-color);
  background: var(--ion-card-background);
  cursor: pointer;
  transition: all 0.2s;
}

.user-card:hover {
  border-color: #2d7a4e;
  box-shadow: 0 2px 8px rgba(45, 122, 78, 0.1);
}

.user-card-selected {
  border-color: #2d7a4e;
  background: color-mix(in srgb, #2d7a4e 12%, var(--ion-card-background));
}

.user-card-highlighted {
  border-color: #fbbf24;
  background: color-mix(in srgb, #fbbf24 20%, var(--ion-card-background));
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.3);
  animation: highlightPulse 0.5s ease-in-out;
}

@keyframes highlightPulse {
  0% {
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.5);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(251, 191, 36, 0.2);
  }
  100% {
    box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.3);
  }
}

.user-checkbox {
  display: flex;
  align-items: flex-start;
  padding-top: 4px;
}

.user-avatar {
  flex-shrink: 0;
}

.avatar-image {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ion-text-color) 10%, var(--ion-card-background));
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-placeholder ion-icon {
  font-size: 24px;
  color: color-mix(in srgb, var(--ion-text-color) 55%, transparent);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--ion-text-color);
}

.user-location {
  margin: 0 0 6px 0;
  font-size: 13px;
  color: color-mix(in srgb, var(--ion-text-color) 60%, transparent);
  display: flex;
  align-items: center;
  gap: 4px;
}

.user-bio {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: color-mix(in srgb, var(--ion-text-color) 78%, transparent);
  line-height: 1.4;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.user-interests {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.interest-badge {
  background: color-mix(in srgb, var(--ion-text-color) 10%, var(--ion-card-background));
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  color: color-mix(in srgb, var(--ion-text-color) 78%, transparent);
}

.user-actions {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
}

.view-profile-btn {
  --border-radius: 6px;
  --padding-start: 12px;
  --padding-end: 12px;
  font-size: 12px;
  height: 32px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: color-mix(in srgb, var(--ion-text-color) 55%, transparent);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--ion-background-color) 88%, transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.loading-overlay ion-spinner {
  width: 40px;
  height: 40px;
  --color: var(--ion-color-primary);
}

.loading-overlay p {
  margin-top: 16px;
  font-size: 16px;
  color: color-mix(in srgb, var(--ion-text-color) 60%, transparent);
}

/* Mobile: Stack vertically */
@media (max-width: 1024px) {
  .map-layout {
    flex-direction: column;
    padding: 72px 16px 48px;
    gap: 16px;
  }

  .map-section {
    height: 50vh;
  }

  .user-panel {
    width: 100%;
    height: 50vh;
  }
}

@media (max-width: 767px) {
  .map-layout {
    padding: 54px 12px 36px;
    gap: 12px;
  }

  .user-panel {
    width: 100%;
  }

  .panel-header {
    padding: 16px;
  }

  .panel-title {
    font-size: 20px;
  }
}
</style>

<!-- Non-scoped styles for Google Maps markers (need to target external DOM) -->
<style>
/* InfoWindow theme (Google renders it outside Vue scope). */
.gm-style .trova-map-infowindow {
  color: var(--ion-text-color);
}
.gm-style .trova-map-infowindow__body {
  color: color-mix(in srgb, var(--ion-text-color) 78%, transparent);
}
.gm-style .trova-map-infowindow__meta {
  color: color-mix(in srgb, var(--ion-text-color) 60%, transparent);
}

/* Cross-origin avatar markers (direct image URL icons) */
.gm-style img[style*="width: 46px"][style*="height: 46px"],
.gm-style img[style*="width: 50px"][style*="height: 50px"],
.gm-style img[width="46"][height="46"],
.gm-style img[width="50"][height="50"] {
  border-radius: 9999px !important;
  object-fit: cover !important;
  /* subtle edge so avatars are readable on dark map */
  outline: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
}
</style>
