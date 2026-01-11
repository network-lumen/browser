import { ref, computed, watch } from 'vue';
import { activeProfileId } from './profilesStore';

type FavMap = Record<string, string[]>;

const KEY = "lumen:favourites:v1";

const raw = localStorage.getItem(KEY);
const data = ref<FavMap>(raw ? JSON.parse(raw) : {});

function save() {
  localStorage.setItem(KEY, JSON.stringify(data.value));
}

function list(profileId: string): string[] {
  return data.value[profileId] || [];
}

function isFavourite(profileId: string, url: string): boolean {
  return list(profileId).includes(url);
}

function toggle(profileId: string, url: string) {
  const arr = list(profileId);
  if (arr.includes(url)) {
    data.value[profileId] = arr.filter(v => v !== url);
  } else {
    data.value[profileId] = [...arr, url];
  }
  save();
}

function remove(profileId: string, url: string) {
  data.value[profileId] = list(profileId).filter(v => v !== url);
  save();
}

export function useFavourites() {
  const currentProfile = computed(() => activeProfileId.value || "default");

  const favourites = computed(() => {
    return list(currentProfile.value);
  });

  function toggleFavourite(url: string) {
    toggle(currentProfile.value, url);
  }

  function isFav(url: string) {
    return isFavourite(currentProfile.value, url);
  }

  function removeFavourite(url: string) {
    remove(currentProfile.value, url);
  }

  return {
    favourites,
    toggleFavourite,
    isFav,
    removeFavourite
  };
}
