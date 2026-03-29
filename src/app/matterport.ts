import { MatterTag } from '../types/matterport';

export function createMatterTag(sdk: any, tag: MatterTag): Promise<string[]> {
  return sdk.Tag.add(tag);
}

/**
 * Add a tag to the current Matterport session (ephemeral — survives page load if
 * also stored in Supabase and re-injected on every SDK init via this function).
 * Tries the new Tag.add() API first, falls back to the deprecated Mattertag.add().
 *
 * Tag.add() signature: Tag.add(...tags: Tag.Descriptor[]): Promise<string[]>
 * Each descriptor is a spread argument, NOT wrapped in an array.
 */
export async function addTagToSession(
  sdk: any,
  opts: { label: string; description?: string; x: number; y: number; z: number; tag_type?: 'room' | 'object' }
): Promise<void> {
  const color = opts.tag_type === 'room'
    ? { r: 1, g: 0.65, b: 0 }
    : { r: 0.2, g: 0.5, b: 1 };
  const tagData = {
    label: opts.label,
    description: opts.description || '',
    anchorPosition: { x: opts.x, y: opts.y, z: opts.z },
    stemVector: { x: 0, y: 0.3, z: 0 },
    color,
  };
  console.log('[addTagToSession] Adding tag:', tagData);
  try {
    // Tag.add(...descriptors) — pass as spread arg, not wrapped in array
    const result: string[] = await sdk.Tag.add(tagData);
    console.log('[addTagToSession] Tag.add succeeded:', result);
    // Immediately suppress native Matterport tag UI for the new tag
    for (const sid of result) {
      try { await sdk.Tag.allowAction(sid, { opening: false, navigating: false }); } catch { /* not critical */ }
    }
    return;
  } catch (err1: unknown) {
    console.warn('[addTagToSession] Tag.add failed:', err1);
  }
  try {
    const result: string[] = await sdk.Mattertag.add(tagData);
    console.log('[addTagToSession] Mattertag.add succeeded:', result);
    for (const sid of result) {
      try { await sdk.Tag.allowAction(sid, { opening: false, navigating: false }); } catch { /* not critical */ }
    }
  } catch (err2: unknown) {
    console.error('[addTagToSession] Both Tag.add and Mattertag.add failed:', err2);
  }
}

export function editMatterTag(sdk: any, tagId: string, updates: Partial<MatterTag>): Promise<void> {
  return sdk.Tag.editBillboard(tagId, updates);
}

export function deleteMatterTag(sdk: any, tagId: string): Promise<void> {
  return sdk.Tag.remove(tagId);
}

export async function getMatterTags(sdk: any): Promise<MatterTag[]> {
  // Tag.data is an IObservable — it has .subscribe() but NOT .getData().
  // Mattertag.getData() is the correct call for this SDK version.
  try {
    return await sdk.Mattertag.getData();
  } catch {
    try { return await sdk.Tag.data.getData(); } catch { return []; }
  }
}

export function injectHTML(sdk: any, tagId: string, html: string): Promise<void> {
  return sdk.Tag.injectHTML(tagId, html);
}

export function createFrameHTML(tagId: string, option: string): string {
  return `
    <div class="matterport-tag-frame">
      <select class="status-select">
        <option value="op1" ${option === 'op1' ? 'selected' : ''}>To Do</option>
        <option value="op2" ${option === 'op2' ? 'selected' : ''}>In Progress</option>
        <option value="op3" ${option === 'op3' ? 'selected' : ''}>Done</option>
      </select>
      <button class="edit-button">Edit task</button>
      <button class="delete-button">Delete task</button>
    </div>
    <style>
      .matterport-tag-frame {
        margin: 0;
        padding: 8px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
        gap: 16px;
      }
      .status-select {
        width: 100%;
        height: 32px;
        border-radius: 16px;
        text-align: center;
        border: none;
        background: #f9f9f9;
        color: #333;
        font-size: 16px;
        padding: 8px;
      }
      .edit-button, .delete-button {
        cursor: pointer;
        width: 100%;
        border: none;
        color: white;
        padding: 8px;
        height: 32px;
        border-radius: 16px;
      }
      .edit-button {
        background: #99f;
      }
      .delete-button {
        background: #f99;
      }
    </style>
    <script>
      document.querySelector('.status-select').addEventListener('change', (e) => {
        window.send('select-changed', "${tagId}", e.target.value);
      });
      document.querySelector('.edit-button').addEventListener('click', () => {
        window.send('edit-tag', "${tagId}");
      });
      document.querySelector('.delete-button').addEventListener('click', () => {
        window.send('delete-tag', "${tagId}");
      });
    </script>
  `;
}
