import { ref, onMounted, onUnmounted } from 'vue';
import { environment } from '@/environments/environment';

export interface PlaceData {
  name: string;
  state?: string;
  country: string;
  lat: number;
  lng: number;
  googlePlaceId: string;
  primaryName: string;
  secondaryName: string;
}

export function useGooglePlaces() {
  const isLoaded = ref(false);
  const isLoading = ref(false);
  let autocompleteInstances: google.maps.places.Autocomplete[] = [];

  async function loadGoogleMapsScript(): Promise<void> {
    if (isLoaded.value || (window as any).google?.maps?.places) {
      isLoaded.value = true;
      return;
    }

    if (isLoading.value) {
      // Wait for existing load
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (isLoaded.value) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }

    isLoading.value = true;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        isLoaded.value = true;
        isLoading.value = false;
        resolve();
      };
      script.onerror = () => {
        isLoading.value = false;
        reject(new Error('Failed to load Google Maps script'));
      };
      document.head.appendChild(script);
    });
  }

  function createAutocomplete(
    inputElement: HTMLInputElement | null,
    onPlaceSelected: (place: PlaceData) => void,
    types: string[] = ['locality', 'sublocality', 'sublocality_level_1', 'neighborhood']
  ): google.maps.places.Autocomplete | null {
    if (!inputElement || !isLoaded.value) {
      return null;
    }

    const google = (window as any).google;
    if (!google?.maps?.places) {
      return null;
    }

    const autocomplete = new google.maps.places.Autocomplete(inputElement, {
      types,
      fields: ['place_id', 'geometry', 'name', 'address_components'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry && place.address_components) {
        const placeData = parsePlaceResult(place);
        onPlaceSelected(placeData);
        inputElement.value = ''; // Clear input after selection
      }
    });

    autocompleteInstances.push(autocomplete);
    return autocomplete;
  }

  function parsePlaceResult(place: google.maps.places.PlaceResult): PlaceData {
    let localityName = '';
    let subLocalityName = '';
    let neighborhoodName = '';
    let state = '';
    let country = '';

    place.address_components?.forEach((component) => {
      component.types.forEach((type) => {
        switch (type) {
          case 'country':
            country = component.long_name || component.short_name || '';
            break;
          case 'locality':
            localityName = component.long_name || component.short_name || '';
            break;
          case 'sublocality':
          case 'sublocality_level_1':
            subLocalityName = component.long_name || component.short_name || '';
            break;
          case 'neighborhood':
            neighborhoodName = component.long_name || component.short_name || '';
            break;
          case 'administrative_area_level_1':
            state = component.short_name || component.long_name || '';
            break;
        }
      });
    });

    // Give preference to most specific areas
    const name = neighborhoodName || subLocalityName || localityName || place.name || '';
    const primaryName = name;
    const secondaryName = country === 'United States' ? state : country;

    const location = place.geometry?.location;
    if (!location) {
      throw new Error('Place geometry is missing');
    }

    const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
    const lng = typeof location.lng === 'function' ? location.lng() : location.lng;

    return {
      name,
      state,
      country,
      lat,
      lng,
      googlePlaceId: place.place_id || '',
      primaryName,
      secondaryName,
    };
  }

  async function searchOrganizations(
    query: string,
    onResults: (organizations: Array<{ name: string }>) => void
  ): Promise<void> {
    if (!isLoaded.value || query.length < 3) {
      onResults([]);
      return;
    }

    const google = (window as any).google;
    if (!google?.maps?.places) {
      onResults([]);
      return;
    }

    const placesService = new google.maps.places.PlacesService(
      document.createElement('div')
    );

    placesService.textSearch(
      { query },
      (results: google.maps.places.PlaceResult[], status: string) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const organizations = results.map((result) => ({
            name: result.name,
          }));

          // Remove duplicates by name (case-insensitive)
          const uniqueOrgs = Array.from(
            new Map(
              organizations.map((org) => [org.name.toLowerCase(), org])
            ).values()
          );

          // Sort by name length
          uniqueOrgs.sort((a, b) => a.name.length - b.name.length);

          // If no results, add the query as a custom option
          if (uniqueOrgs.length === 0 && query.length >= 3) {
            uniqueOrgs.push({ name: query });
          }

          onResults(uniqueOrgs);
        } else {
          // If no results, allow custom entry
          if (query.length >= 3) {
            onResults([{ name: query }]);
          } else {
            onResults([]);
          }
        }
      }
    );
  }

  function cleanup() {
    autocompleteInstances = [];
  }

  onUnmounted(() => {
    cleanup();
  });

  return {
    isLoaded,
    isLoading,
    loadGoogleMapsScript,
    createAutocomplete,
    parsePlaceResult,
    searchOrganizations,
    cleanup,
  };
}

