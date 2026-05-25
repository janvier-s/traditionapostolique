import { topics, quotes, topicBySlug } from '$lib/data';
import { isTheme, aspectsOf, primaryAspectOf } from '$lib/data/topic-helpers';
import { error } from '@sveltejs/kit';

export const prerender = true;

export function entries() {
  return topics
    .filter((t) => {
      const hasChildren = topics.some((x) => x.parentId === t.id);
      const hasDirectQuotes = quotes.some((q) => q.topicIds.includes(t.id));
      return hasChildren && !hasDirectQuotes;
    })
    .map((t) => ({ slug: t.slug }));
}

export function load({ params }) {
  const theme = topicBySlug(params.slug);
  // A topic is a theme when it has children AND no direct quote refs (spec invariant #2).
  if (!theme || !isTheme(theme.id, topics) || quotes.some((q) => q.topicIds.includes(theme.id))) {
    throw error(404, 'Thème introuvable');
  }
  const counts = new Map<number, number>();
  for (const q of quotes) for (const tid of q.topicIds) counts.set(tid, (counts.get(tid) ?? 0) + 1);
  const aspects = aspectsOf(theme.id, topics)
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id - b.id)
    .map((a) => ({
      id: a.id,
      slug: a.slug,
      label: a.label,
      description: a.description,
      isPrimary: a.primary === true,
      count: counts.get(a.id) ?? 0
    }));
  const primary = primaryAspectOf(theme.id, topics);
  return {
    theme: {
      id: theme.id,
      slug: theme.slug,
      label: theme.label,
      description: theme.description,
      pillar: theme.pillar
    },
    aspects,
    primarySlug: primary?.slug
  };
}
