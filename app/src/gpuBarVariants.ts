export const gpuBarVariants = [
  { id: 'fine', name: 'Fine lines', detail: 'Light and precise', marks: 1 },
  { id: 'slender', name: 'Slender', detail: 'A little more weight', marks: 1 },
  { id: 'tall', name: 'Tall', detail: 'A taller profile', marks: 1 },
  { id: 'outline', name: 'Outline', detail: 'Outlined idle hours', marks: 1 },
  { id: 'quiet', name: 'Quiet', detail: 'Muted idle hours', marks: 1 },
  { id: 'clusters', name: 'Hour clusters', detail: 'Three thin lines per hour', marks: 3 },
] as const;

export type GpuBarVariant = typeof gpuBarVariants[number]['id'];
export function gpuBarVariant(value: string | null): GpuBarVariant {
  return gpuBarVariants.find(item => item.id === value)?.id ?? 'slender';
}
