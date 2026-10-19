/** Haven craft→hotspot quests (Merge-Prison-style UX, Haven story). */

export type PortraitId = 'mira' | 'theo' | 'lina'

export interface HavenHotspot {
  id: string
  /** Area that must be restored on the story map first */
  areaId: string
  title: string
  /** Character who reacts */
  character: string
  portrait: PortraitId
  /** Short line after successful use */
  line: string
  /** Item that must be selected / crafted */
  needItemId: string
  /** Optional extra ★ spend when using */
  starCost: number
  /** Position on the scrollable scene (scene pixels, width ~780) */
  x: number
  y: number
  /** Stars awarded on complete */
  rewardStars: number
}

export const SCENE_WIDTH = 780
export const SCENE_HEIGHT = 260

/** Snackable craft→use beats inside restored Haven areas. */
export const HOTSPOTS: HavenHotspot[] = [
  {
    id: 'hs_trellis',
    areaId: 'garden',
    title: 'Tangled Trellis',
    character: 'Mira',
    portrait: 'mira',
    line: 'The vines part… sunlight finds the beds again.',
    needItemId: 'crops_3',
    starCost: 0,
    x: 120,
    y: 150,
    rewardStars: 1,
  },
  {
    id: 'hs_planter',
    areaId: 'garden',
    title: 'Empty Planter',
    character: 'Mira',
    portrait: 'mira',
    line: 'Carrots already? Haven never forgot how to grow.',
    needItemId: 'crops_4',
    starCost: 1,
    x: 220,
    y: 175,
    rewardStars: 1,
  },
  {
    id: 'hs_plank',
    areaId: 'bridge',
    title: 'Loose Planks',
    character: 'Theo',
    portrait: 'theo',
    line: 'Steady now — the far bank waves hello.',
    needItemId: 'tools_3',
    starCost: 1,
    x: 380,
    y: 140,
    rewardStars: 1,
  },
  {
    id: 'hs_bench',
    areaId: 'workshop',
    title: 'Silent Workbench',
    character: 'Theo',
    portrait: 'theo',
    line: 'One good wrench and the shed hums again.',
    needItemId: 'tools_2',
    starCost: 0,
    x: 500,
    y: 160,
    rewardStars: 1,
  },
  {
    id: 'hs_crate',
    areaId: 'workshop',
    title: 'Stuck Tool Crate',
    character: 'Theo',
    portrait: 'theo',
    line: 'The crate clicks open. Fresh bolts for later.',
    needItemId: 'tools_4',
    starCost: 2,
    x: 560,
    y: 185,
    rewardStars: 2,
  },
  {
    id: 'hs_awning',
    areaId: 'cafe',
    title: 'Dusty Awning',
    character: 'Lina',
    portrait: 'lina',
    line: 'Steam rises. First latte of the new season.',
    needItemId: 'crops_5',
    starCost: 2,
    x: 650,
    y: 145,
    rewardStars: 2,
  },
  {
    id: 'hs_door',
    areaId: 'cottage',
    title: 'Cottage Latch',
    character: 'Lina',
    portrait: 'lina',
    line: 'Curtains flutter. A note says: welcome home.',
    needItemId: 'tools_5',
    starCost: 3,
    x: 720,
    y: 155,
    rewardStars: 3,
  },
]

export function hotspotById(id: string): HavenHotspot | undefined {
  return HOTSPOTS.find((h) => h.id === id)
}

/** Next incomplete hotspot the player can work toward. */
export function nextQuest(
  completed: string[],
  unlockedStory: string[],
): HavenHotspot | undefined {
  return HOTSPOTS.find(
    (h) => !completed.includes(h.id) && unlockedStory.includes(h.areaId),
  )
}
