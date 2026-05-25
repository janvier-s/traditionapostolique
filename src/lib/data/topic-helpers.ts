import type { Topic } from '$lib/schema';

export function isTheme(topicId: number, allTopics: readonly Topic[]): boolean {
  return allTopics.some((t) => t.parentId === topicId);
}

export function aspectsOf(themeId: number, allTopics: readonly Topic[]): Topic[] {
  return allTopics.filter((t) => t.parentId === themeId);
}

export function primaryAspectOf(themeId: number, allTopics: readonly Topic[]): Topic | undefined {
  return allTopics.find((t) => t.parentId === themeId && t.primary === true);
}

export function themeOf(aspectId: number, allTopics: readonly Topic[]): Topic | undefined {
  const aspect = allTopics.find((t) => t.id === aspectId);
  if (!aspect || aspect.parentId == null) return undefined;
  return allTopics.find((t) => t.id === aspect.parentId);
}
