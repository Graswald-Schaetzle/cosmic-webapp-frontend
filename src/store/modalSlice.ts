import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { MatterTag } from '../types/matterport';
import { LocationDetailResponse } from '../api/locationApi/locationApi';

interface ModalState {
  matterTagWindowModal: {
    isOpen: boolean;
    selectedTag: MatterTag | LocationDetailResponse | null;
    activeTab?: number;
  };
  dashboardWindowModal: {
    isOpen: boolean;
  };
  notificationWindowModal: {
    isOpen: boolean;
    selectedNotificationId?: number | null;
  };
  taskWindowModal: {
    isOpen: boolean;
    taskId: number | null;
    source: string | null;
    mattertagData?: MatterTag | LocationDetailResponse | null;
    listId?: number | null;
    redirectBack?: {
      type: 'mattertag' | 'calendar' | 'tasks' | 'lists';
      tagData?: LocationDetailResponse;
      listId?: number;
    } | null;
  };
  tasksWindowModal: {
    isOpen: boolean;
    activeTab: number;
  };
  newTaskWindowModal: {
    isOpen: boolean;
    preSelectedLocation?: {
      id: string;
      name: string;
      room_id?: number;
    } | null;
    preSelectedDate?: string | null;
    redirectBack?: {
      type: 'mattertag' | 'calendar';
      tagData?: LocationDetailResponse;
    } | null;
  };
  listWindowModal: {
    isOpen: boolean;
    listId: number | null;
  };
  listsWindowModal: {
    isOpen: boolean;
  };
  newListWindowModal: {
    isOpen: boolean;
  };
  documentsWindowModal: {
    isOpen: boolean;
  };
  documentInfoWindowModal: {
    isOpen: boolean;
    docId: string | null;
    redirectBack?: {
      type: 'mattertag';
      tagData?: LocationDetailResponse;
    } | null;
  };
  addDocumentWindowModal: {
    isOpen: boolean;
    preSelectedLocation?: {
      id: string;
      name: string;
      room_id?: number;
    } | null;
    redirectBack?: {
      type: 'mattertag';
      tagData?: LocationDetailResponse;
    } | null;
  };
  objectManagerWindowModal: {
    isOpen: boolean;
  };
  calendarWindowModal: {
    isOpen: boolean;
    selectedDate?: Date | null;
  };
  reconstructionWindowModal: {
    isOpen: boolean;
    spaceId?: number | null;
  };
  spacesWindowModal: {
    isOpen: boolean;
  };
  spaceViewerWindowModal: {
    isOpen: boolean;
    spaceId: number | null;
    spaceName: string | null;
    modelUrl: string | null;
    jobId: number | null;
  };
}

const initialState: ModalState = {
  matterTagWindowModal: {
    isOpen: false,
    selectedTag: null,
    activeTab: 0,
  },
  dashboardWindowModal: {
    isOpen: false,
  },
  notificationWindowModal: {
    isOpen: false,
    selectedNotificationId: null,
  },
  taskWindowModal: {
    isOpen: false,
    taskId: null,
    source: null,
    mattertagData: null,
    listId: null,
    redirectBack: null,
  },
  tasksWindowModal: {
    isOpen: false,
    activeTab: 0,
  },
  newTaskWindowModal: {
    isOpen: false,
    preSelectedLocation: null,
    preSelectedDate: null,
    redirectBack: null,
  },
  listWindowModal: {
    isOpen: false,
    listId: null,
  },
  listsWindowModal: {
    isOpen: false,
  },
  newListWindowModal: {
    isOpen: false,
  },
  documentsWindowModal: {
    isOpen: false,
  },
  documentInfoWindowModal: {
    isOpen: false,
    docId: null,
    redirectBack: null,
  },
  addDocumentWindowModal: {
    isOpen: false,
    preSelectedLocation: null,
    redirectBack: null,
  },
  objectManagerWindowModal: {
    isOpen: false,
  },
  calendarWindowModal: {
    isOpen: false,
    selectedDate: null,
  },
  reconstructionWindowModal: {
    isOpen: false,
    spaceId: null,
  },
  spacesWindowModal: {
    isOpen: false,
  },
  spaceViewerWindowModal: {
    isOpen: false,
    spaceId: null,
    spaceName: null,
    modelUrl: null,
    jobId: null,
  },
};

const modalSlice = createSlice({
  name: 'modal',
  initialState,
  reducers: {
    openMatterTagWindow: (
      state,
      action: PayloadAction<
        | MatterTag
        | LocationDetailResponse
        | { tag: MatterTag | LocationDetailResponse; activeTab?: number }
      >
    ) => {
      if ('tag' in action.payload) {
        state.matterTagWindowModal.isOpen = true;
        state.matterTagWindowModal.selectedTag = action.payload.tag;
        state.matterTagWindowModal.activeTab = action.payload.activeTab || 0;
      } else {
        state.matterTagWindowModal.isOpen = true;
        state.matterTagWindowModal.selectedTag = action.payload;
        state.matterTagWindowModal.activeTab = 0;
      }
    },
    closeMatterTagWindow: state => {
      state.matterTagWindowModal.isOpen = false;
      state.matterTagWindowModal.selectedTag = null;
      state.matterTagWindowModal.activeTab = 0;
    },
    setMatterTagActiveTab: (state, action: PayloadAction<number>) => {
      state.matterTagWindowModal.activeTab = action.payload;
    },
    openDashboardWindow: state => {
      state.dashboardWindowModal.isOpen = true;
    },
    closeDashboardWindow: state => {
      state.dashboardWindowModal.isOpen = false;
    },
    openTaskWindow: (
      state,
      action: PayloadAction<{
        taskId: number;
        source: string;
        mattertagData?: MatterTag | LocationDetailResponse;
        listId?: number;
        redirectBack?: {
          type: 'mattertag' | 'calendar' | 'tasks' | 'lists';
          tagData?: LocationDetailResponse;
          listId?: number;
        };
      }>
    ) => {
      state.taskWindowModal.isOpen = true;
      state.taskWindowModal.taskId = action.payload.taskId;
      state.taskWindowModal.source = action.payload.source;
      state.taskWindowModal.mattertagData = action.payload.mattertagData || null;
      state.taskWindowModal.listId = action.payload.listId || null;
      state.taskWindowModal.redirectBack = action.payload.redirectBack || null;
    },
    closeTaskWindow: state => {
      state.taskWindowModal.isOpen = false;
      state.taskWindowModal.taskId = null;
      state.taskWindowModal.source = null;
      state.taskWindowModal.mattertagData = null;
      state.taskWindowModal.listId = null;
      state.taskWindowModal.redirectBack = null;
    },
    openTasksWindow: (state, action: PayloadAction<{ activeTab?: number } | undefined>) => {
      state.tasksWindowModal.isOpen = true;
      state.tasksWindowModal.activeTab = action.payload?.activeTab || 0;
    },
    closeTasksWindow: state => {
      state.tasksWindowModal.isOpen = false;
    },
    openNewTaskWindow: (
      state,
      action: PayloadAction<
        | {
            preSelectedLocation?: { id: string; name: string; room_id?: number };
            preSelectedDate?: string;
            redirectBack?: { type: 'mattertag' | 'calendar'; tagData?: LocationDetailResponse };
          }
        | undefined
      >
    ) => {
      state.newTaskWindowModal.isOpen = true;
      state.newTaskWindowModal.preSelectedLocation = action.payload?.preSelectedLocation || null;
      state.newTaskWindowModal.preSelectedDate = action.payload?.preSelectedDate || null;
      state.newTaskWindowModal.redirectBack = action.payload?.redirectBack || null;
    },
    closeNewTaskWindow: state => {
      state.newTaskWindowModal.isOpen = false;
      state.newTaskWindowModal.preSelectedLocation = null;
      state.newTaskWindowModal.preSelectedDate = null;
      state.newTaskWindowModal.redirectBack = null;
    },
    openListWindow: (state, action: PayloadAction<number>) => {
      state.listWindowModal.isOpen = true;
      state.listWindowModal.listId = action.payload;
    },
    closeListWindow: state => {
      state.listWindowModal.isOpen = false;
      state.listWindowModal.listId = null;
    },

    openListsWindow: state => {
      state.listsWindowModal.isOpen = true;
    },
    closeListsWindow: state => {
      state.listsWindowModal.isOpen = false;
    },
    openNewListWindow: state => {
      state.newListWindowModal.isOpen = true;
    },
    closeNewListWindow: state => {
      state.newListWindowModal.isOpen = false;
    },
    openDocumentsWindow: state => {
      state.documentsWindowModal.isOpen = true;
    },
    closeDocumentsWindow: state => {
      state.documentsWindowModal.isOpen = false;
    },
    openDocumentInfoWindow: (
      state,
      action: PayloadAction<
        | string
        | {
            docId: string;
            redirectBack?: {
              type: 'mattertag';
              tagData?: LocationDetailResponse;
            };
          }
      >
    ) => {
      state.documentInfoWindowModal.isOpen = true;
      if (typeof action.payload === 'string') {
        state.documentInfoWindowModal.docId = action.payload;
        state.documentInfoWindowModal.redirectBack = null;
      } else {
        state.documentInfoWindowModal.docId = action.payload.docId;
        state.documentInfoWindowModal.redirectBack = action.payload.redirectBack || null;
      }
    },
    closeDocumentInfoWindow: state => {
      state.documentInfoWindowModal.isOpen = false;
      state.documentInfoWindowModal.docId = null;
      state.documentInfoWindowModal.redirectBack = null;
    },
    openAddDocumentWindow: (
      state,
      action: PayloadAction<
        | {
            preSelectedLocation?: { id: string; name: string; room_id?: number };
            redirectBack?: { type: 'mattertag'; tagData?: LocationDetailResponse };
          }
        | undefined
      >
    ) => {
      state.addDocumentWindowModal.isOpen = true;
      state.addDocumentWindowModal.preSelectedLocation =
        action.payload?.preSelectedLocation || null;
      state.addDocumentWindowModal.redirectBack = action.payload?.redirectBack || null;
    },
    closeAddDocumentWindow: state => {
      state.addDocumentWindowModal.isOpen = false;
      state.addDocumentWindowModal.preSelectedLocation = null;
      state.addDocumentWindowModal.redirectBack = null;
    },

    openNotificationWindow: (
      state,
      action: PayloadAction<{ selectedNotificationId?: number } | undefined>
    ) => {
      state.notificationWindowModal.isOpen = true;
      state.notificationWindowModal.selectedNotificationId =
        action.payload?.selectedNotificationId || null;
    },
    closeNotificationWindow: state => {
      state.notificationWindowModal.isOpen = false;
      state.notificationWindowModal.selectedNotificationId = null;
    },
    openObjectManagerWindow: state => {
      state.objectManagerWindowModal.isOpen = true;
    },
    closeObjectManagerWindow: state => {
      state.objectManagerWindowModal.isOpen = false;
    },
    openCalendarWindow: (state, action: PayloadAction<{ selectedDate?: Date } | undefined>) => {
      state.calendarWindowModal.isOpen = true;
      state.calendarWindowModal.selectedDate = action.payload?.selectedDate || null;
    },
    closeCalendarWindow: state => {
      state.calendarWindowModal.isOpen = false;
      state.calendarWindowModal.selectedDate = null;
    },
    openReconstructionWindow: (state, action: PayloadAction<{ spaceId?: number } | undefined>) => {
      state.reconstructionWindowModal.isOpen = true;
      state.reconstructionWindowModal.spaceId = action.payload?.spaceId || null;
    },
    closeReconstructionWindow: state => {
      state.reconstructionWindowModal.isOpen = false;
      state.reconstructionWindowModal.spaceId = null;
    },
    openSpacesWindow: state => {
      state.spacesWindowModal.isOpen = true;
    },
    closeSpacesWindow: state => {
      state.spacesWindowModal.isOpen = false;
    },
    openSpaceViewerWindow: (
      state,
      action: PayloadAction<{
        spaceId: number;
        spaceName: string;
        modelUrl: string | null;
        jobId: number | null;
      }>
    ) => {
      state.spaceViewerWindowModal.isOpen = true;
      state.spaceViewerWindowModal.spaceId = action.payload.spaceId;
      state.spaceViewerWindowModal.spaceName = action.payload.spaceName;
      state.spaceViewerWindowModal.modelUrl = action.payload.modelUrl;
      state.spaceViewerWindowModal.jobId = action.payload.jobId;
    },
    closeSpaceViewerWindow: state => {
      state.spaceViewerWindowModal.isOpen = false;
      state.spaceViewerWindowModal.spaceId = null;
      state.spaceViewerWindowModal.spaceName = null;
      state.spaceViewerWindowModal.modelUrl = null;
      state.spaceViewerWindowModal.jobId = null;
    },
    closeAllModals: state => {
      state.matterTagWindowModal.isOpen = false;
      state.matterTagWindowModal.selectedTag = null;
      state.matterTagWindowModal.activeTab = 0;
      state.dashboardWindowModal.isOpen = false;
      state.notificationWindowModal.isOpen = false;
      state.taskWindowModal.isOpen = false;
      state.taskWindowModal.taskId = null;
      state.taskWindowModal.source = null;
      state.taskWindowModal.mattertagData = null;
      state.taskWindowModal.listId = null;
      state.taskWindowModal.redirectBack = null;
      state.tasksWindowModal.isOpen = false;
      state.newTaskWindowModal.isOpen = false;
      state.newTaskWindowModal.preSelectedLocation = null;
      state.newTaskWindowModal.preSelectedDate = null;
      state.newTaskWindowModal.redirectBack = null;
      state.listWindowModal.isOpen = false;
      state.listWindowModal.listId = null;
      state.listsWindowModal.isOpen = false;
      state.newListWindowModal.isOpen = false;
      state.documentsWindowModal.isOpen = false;
      state.documentInfoWindowModal.isOpen = false;
      state.documentInfoWindowModal.docId = null;
      state.addDocumentWindowModal.isOpen = false;
      state.addDocumentWindowModal.preSelectedLocation = null;
      state.addDocumentWindowModal.redirectBack = null;
      state.objectManagerWindowModal.isOpen = false;
      state.calendarWindowModal.isOpen = false;
      state.calendarWindowModal.selectedDate = null;
      state.reconstructionWindowModal.isOpen = false;
      state.reconstructionWindowModal.spaceId = null;
      state.spacesWindowModal.isOpen = false;
      state.spaceViewerWindowModal.isOpen = false;
      state.spaceViewerWindowModal.spaceId = null;
      state.spaceViewerWindowModal.spaceName = null;
      state.spaceViewerWindowModal.modelUrl = null;
      state.spaceViewerWindowModal.jobId = null;
    },
  },
});

export const {
  openMatterTagWindow,
  closeMatterTagWindow,
  setMatterTagActiveTab,
  openDashboardWindow,
  closeDashboardWindow,
  openNotificationWindow,
  closeNotificationWindow,
  openTaskWindow,
  closeTaskWindow,
  openTasksWindow,
  closeTasksWindow,
  openNewTaskWindow,
  closeNewTaskWindow,
  openListWindow,
  closeListWindow,
  openListsWindow,
  closeListsWindow,
  openNewListWindow,
  closeNewListWindow,
  openDocumentsWindow,
  closeDocumentsWindow,
  openDocumentInfoWindow,
  closeDocumentInfoWindow,
  openAddDocumentWindow,
  closeAddDocumentWindow,
  openObjectManagerWindow,
  closeObjectManagerWindow,
  openCalendarWindow,
  closeCalendarWindow,
  openReconstructionWindow,
  closeReconstructionWindow,
  openSpacesWindow,
  closeSpacesWindow,
  openSpaceViewerWindow,
  closeSpaceViewerWindow,
  closeAllModals,
} = modalSlice.actions;

export default modalSlice.reducer;
