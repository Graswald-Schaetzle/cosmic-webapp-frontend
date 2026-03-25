import { MatterTag } from '../types/matterport';

export function createMatterTag(sdk: any, tag: MatterTag): Promise<string[]> {
  return sdk.Tag.add([tag]);
}

export function editMatterTag(sdk: any, tagId: string, updates: Partial<MatterTag>): Promise<void> {
  return sdk.Tag.editBillboard(tagId, updates);
}

export function deleteMatterTag(sdk: any, tagId: string): Promise<void> {
  return sdk.Tag.remove(tagId);
}

export function getMatterTags(sdk: any): Promise<MatterTag[]> {
  return sdk.Tag.data.getData();
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
