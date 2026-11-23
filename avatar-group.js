// Progressive enhancement: the contributors remain ordinary links while the
// original Animate UI island loads. Fetch its React runtime only when needed.
const armed = new WeakSet();
export function initAvatarGroup(group) {
  if (armed.has(group)) return;
  armed.add(group);
  let observer, loading = false;
  const load = async () => {
    if (loading || !group.isConnected) return;
    loading = true;
    observer?.disconnect();
    group.removeEventListener('pointerenter', load);
    group.removeEventListener('focusin', load);
    try {
      const { mountAvatarGroup } = await import('./vendor/avatar-group-2.4.6.js?v=1fff2466');
      if (!group.isConnected) return;
      // Replacing the fallback would drop keyboard focus while the import
      // finishes. Keep its usable links until focus has left the whole group.
      if (group.contains(document.activeElement)) {
        const afterFocus = event => {
          if (group.contains(event.relatedTarget)) return;
          group.removeEventListener('focusout', afterFocus);
          if (group.isConnected) mountAvatarGroup(group);
        };
        group.addEventListener('focusout', afterFocus);
      } else mountAvatarGroup(group);
    } catch (error) {
      // The original links remain usable if enhancement cannot be loaded.
      console.error('Unable to load contributor animation', error);
    }
  };
  group.addEventListener('pointerenter', load);
  group.addEventListener('focusin', load);
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) load();
    });
    observer.observe(group.closest('[data-card="community"]') ?? group);
  }
}
