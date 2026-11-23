// Progressive enhancement: the contributors remain ordinary links while the
// original Animate UI island loads. Keep its React runtime out of page boot.
export async function initAvatarGroup(group) {
  try {
    const { mountAvatarGroup } = await import('./vendor/avatar-group-2.4.6.js?v=1fff2466');
    if (group.isConnected) mountAvatarGroup(group);
  } catch (error) {
    console.error('Unable to load contributor animation', error);
  }
}
