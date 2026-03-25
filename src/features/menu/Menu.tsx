import { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { DndProvider, useDrag, useDrop, DragSourceMonitor } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  openDashboardWindow,
  openTasksWindow,
  openDocumentsWindow,
  openNotificationWindow,
  openObjectManagerWindow,
  openCalendarWindow,
  openReconstructionWindow,
  openSpacesWindow,
  closeAllModals,
} from '../../store/modalSlice.ts';
import { RootState } from '../../store/store';
import { useMatterport } from '../../contexts/MatterportContext';
import {
  Box,
  Paper,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  styled,
} from '@mui/material';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import TakeoutDiningIcon from '@mui/icons-material/TakeoutDining';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import type { SvgIconProps } from '@mui/material';
import {
  useGetUserMenuQuery,
  useUpdateUserMenuMutation,
  UserMenuPayload,
} from '../../api/userMenu/userMenuApi';

interface MenuItem {
  id: string;
  icon: string;
  muiIcon?: React.ComponentType<SvgIconProps>;
  label: string;
  section: 'main' | 'other';
  order: number;
  name: string;
}

const DND_TYPE = 'MENU_ITEM';

const defaultMenuItems: MenuItem[] = [
  { id: 'dashboard', icon: '/icons/menu/white/dashboard.svg', label: 'Dashboard', section: 'main', order: 0, name: 'Dashboard' },
  { id: 'objects', icon: '/icons/menu/white/objects.svg', label: 'Objects', section: 'main', order: 1, name: 'Objects' },
  { id: 'tasks', icon: '/icons/menu/white/tasks.svg', label: 'Tasks', section: 'main', order: 2, name: 'Tasks' },
  { id: 'notifications', icon: '/icons/menu/white/notifications.svg', label: 'Notifications', section: 'main', order: 3, name: 'Notifications' },
  { id: 'calendar', icon: '/icons/menu/white/calendar.svg', label: 'Calendar', section: 'main', order: 4, name: 'Calendar' },
  { id: 'documents', icon: '/icons/menu/white/documents.svg', label: 'Documents', section: 'main', order: 5, name: 'Documents' },
  { id: 'profile', icon: '/icons/menu/white/profile.svg', label: 'Profile', section: 'main', order: 6, name: 'Profile' },
  { id: 'interior-designer', icon: '', muiIcon: DesignServicesIcon, label: 'Interior Designer', section: 'other', order: 0, name: 'Interior Designer' },
  { id: 'food-delivery', icon: '', muiIcon: TakeoutDiningIcon, label: 'Food Delivery', section: 'other', order: 1, name: 'Food Delivery' },
  { id: 'insurance', icon: '', muiIcon: HealthAndSafetyIcon, label: 'Insurance', section: 'other', order: 2, name: 'Insurance' },
  { id: 'games', icon: '', muiIcon: SportsEsportsIcon, label: 'Games', section: 'other', order: 3, name: 'Games' },
  { id: 'reconstruction', icon: '/icons/menu/white/3d-reconstruction.svg', label: '3D Reconstruction', section: 'other', order: 4, name: '3D Reconstruction' },
  { id: 'spaces', icon: '', muiIcon: HomeWorkIcon, label: 'My Spaces', section: 'other', order: 5, name: 'My Spaces' },
];

// --- Styled Components ---

const StyledPaper = styled(Paper)({
  position: 'fixed',
  top: '50%',
  right: 40,
  transform: 'translateY(-50%)',
  width: 64,
  borderRadius: 34,
  padding: 12,
  background: 'var(--Back, #2E2E2E59)',
  backdropFilter: 'blur(100px)',
  WebkitBackdropFilter: 'blur(100px)',
  transition: 'all 0.3s ease',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  boxShadow: 'none',
  '&.expanded': {
    width: 184,
    '& .MuiListItem': {
      width: '100%',
    },
    '& .MuiListItemText-primary': {
      transform: 'scaleX(1)',
      opacity: 1,
    },
  },
});

const StyledListItem = styled(ListItem)({
  borderRadius: 20,
  color: 'white',
  justifyContent: 'center',
  alignItems: 'center',
  opacity: 0.75,
  padding: '8px',
  width: '100%',
  height: 40,
  minHeight: 40,
  transition: 'all 0.3s ease',
  cursor: 'grab',
  display: 'flex',
  gap: '8px',
  '&:hover': {
    opacity: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  '&.selected': {
    backgroundColor: 'white',
    opacity: 1,
    '& .MuiListItemText-primary': {
      color: 'black',
    },
    '& img, & .MuiSvgIcon-root': {
      filter: 'brightness(0)',
    },
  },
});

const StyledListItemText = styled(ListItemText)({
  margin: 0,
  '& .MuiListItemText-primary': {
    transform: 'scaleX(0)',
    opacity: 0,
    transition: 'all 0.3s ease',
    transformOrigin: 'left',
    whiteSpace: 'nowrap',
    color: 'white',
    fontSize: '14px',
    lineHeight: '20px',
  },
});

const StyledListItemIcon = styled(ListItemIcon)({
  width: 24,
  height: 24,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minWidth: 'auto',
  marginRight: 0,
  flexShrink: 0,
  padding: 0,
});

const OtherElementsPaper = styled(Paper)(({ theme }) => ({
  width: '100%',
  borderRadius: 32,
  padding: theme.spacing(1.5),
  background: 'var(--Back, #2E2E2E59)',
  backdropFilter: 'blur(100px)',
  WebkitBackdropFilter: 'blur(100px)',
  transition: 'all 0.3s ease',
  boxShadow: 'none',
  '&.hidden': {
    opacity: 0,
    pointerEvents: 'none',
    transform: 'scaleX(0)',
  },
  '& .MuiListItemText-primary': {
    transform: 'scaleX(1) !important',
    opacity: '1 !important',
    color: 'white',
    whiteSpace: 'nowrap',
  },
  '& .MuiListItem': {
    minWidth: 'fit-content',
  },
}));



const Icon = styled('img')({
  width: 24,
  height: 24,
});

const MuiMenuIcon = styled('span')({
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& .MuiSvgIcon-root': {
    width: 20,
    height: 20,
    fill: 'white',
  },
});

function MenuItemIcon({ item }: { item: MenuItem }) {
  if (item.muiIcon) {
    const MuiComp = item.muiIcon;
    return (
      <MuiMenuIcon>
        <MuiComp sx={{ fontSize: 20, fill: 'white' }} />
      </MuiMenuIcon>
    );
  }
  return <Icon src={item.icon} alt={item.label} />;
}

// Global pulse animation
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.1); }
      100% { opacity: 1; transform: scale(1); }
    }
  `;
  if (!document.querySelector('[data-menu-pulse]')) {
    styleElement.setAttribute('data-menu-pulse', 'true');
    document.head.appendChild(styleElement);
  }
}

// --- Interfaces ---

interface DragItem {
  id: string;
  index: number;
  sourceList: string;
  moved?: boolean;
}

// --- DropZone Component (between items) ---

interface DropZoneProps {
  targetList: string;
  targetIndex: number;
  onDrop: (sourceList: string, sourceIndex: number, targetList: string, targetIndex: number) => void;
}

function DropZone({ targetList, targetIndex, onDrop }: DropZoneProps) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: DND_TYPE,
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
    drop: (item: DragItem) => {
      if (item.sourceList === targetList && item.index === targetIndex) return;
      if (item.sourceList === targetList && item.index === targetIndex - 1) return;
      onDrop(item.sourceList, item.index, targetList, targetIndex);
    },
  });

  const active = isOver && canDrop;

  return (
    <div
      ref={drop}
      style={{
        height: active ? '16px' : '4px',
        borderRadius: '8px',
        backgroundColor: active
          ? 'rgba(255, 255, 255, 0.45)'
          : 'transparent',
        boxShadow: active
          ? '0 0 8px rgba(255, 255, 255, 0.3)'
          : 'none',
        transition: 'all 0.2s ease',
        flexShrink: 0,
        margin: active ? '2px 0' : '0',
      }}
    />
  );
}

// --- DraggableMenuItem Component ---

interface DraggableMenuItemProps {
  item: MenuItem;
  index: number;
  listType: string;
  onItemClick: (id: string) => void;
  isOpen: boolean;
  isObjectsOpen: boolean;
  isWide: boolean;
  layout?: 'list' | 'grid';
  onHoverMove?: (
    sourceList: string,
    sourceIndex: number,
    targetList: string,
    targetIndex: number
  ) => void;
  onDragStart?: () => void;
  onDragEnd?: (didDrop: boolean, moved: boolean) => void;
}

function DraggableMenuItem({
  item,
  index,
  listType,
  onItemClick,
  isOpen,
  isObjectsOpen,
  isWide,
  layout = 'list',
  onHoverMove,
  onDragStart,
  onDragEnd,
}: DraggableMenuItemProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [{ isDragging }, drag] = useDrag({
    type: DND_TYPE,
    item: () => {
      onDragStart?.();
      return { id: item.id, index, sourceList: listType, moved: false };
    },
    end: (draggedItem, monitor) => {
      onDragEnd?.(monitor.didDrop(), Boolean(draggedItem?.moved));
    },
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const isSelected =
    (item.id === 'dashboard' && isOpen) || (item.id === 'objects' && isObjectsOpen);

  const [, drop] = useDrop({
    accept: DND_TYPE,
    hover: (draggedItem: DragItem, monitor) => {
      if (!ref.current || !onHoverMove) return;

      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      const hoverRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverRect.right - hoverRect.left) / 2;
      const hoverMiddleY = (hoverRect.bottom - hoverRect.top) / 2;
      const hoverClientX = clientOffset.x - hoverRect.left;
      const hoverClientY = clientOffset.y - hoverRect.top;
      const sameList = draggedItem.sourceList === listType;

      if (sameList && draggedItem.index === index) return;

      const insertAfter =
        layout === 'grid' && sameList && Math.floor(draggedItem.index / 3) === Math.floor(index / 3)
          ? hoverClientX > hoverMiddleX
          : hoverClientY > hoverMiddleY;

      const targetIndex = index + (insertAfter ? 1 : 0);
      if (sameList && draggedItem.index < targetIndex && draggedItem.index + 1 === targetIndex) {
        return;
      }
      if (sameList && draggedItem.index === targetIndex) {
        return;
      }

      onHoverMove(draggedItem.sourceList, draggedItem.index, listType, targetIndex);
      draggedItem.sourceList = listType;
      draggedItem.index =
        sameList && draggedItem.index < targetIndex ? targetIndex - 1 : targetIndex;
      draggedItem.moved = true;
    },
    drop: () => ({ handled: true }),
  });
  drag(drop(ref));

  if (layout === 'grid') {
    return (
      <Box
        ref={ref}
        sx={{
          opacity: isDragging ? 0.4 : 1,
          cursor: 'grab',
          transform: isDragging ? 'scale(1.06)' : 'scale(1)',
          transition: 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            p: 1,
            borderRadius: 3,
            opacity: isSelected ? 1 : 0.75,
            backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.18)' : 'transparent',
            '&:hover': { opacity: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
            minWidth: 56,
            transition:
              'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.2s ease, opacity 0.2s ease',
          }}
          onClick={() => onItemClick(item.id)}
        >
          <MenuItemIcon item={item} />
          <Typography
            sx={{
              color: 'white',
              fontSize: 10,
              lineHeight: '12px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <div
      ref={ref}
      style={{
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
        transform: isDragging ? 'scale(1.03)' : 'scale(1)',
        transition: 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease',
      }}
    >
      <StyledListItem
        onClick={() => onItemClick(item.id)}
        className={isSelected ? 'selected' : ''}
        sx={{
          transition:
            'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease',
        }}
      >
        <StyledListItemIcon>
          <MenuItemIcon item={item} />
        </StyledListItemIcon>
        {isWide && <StyledListItemText primary={item.label} />}
      </StyledListItem>
    </div>
  );
}

// --- DroppableMoreButton Component (uses useDrop, must be inside DndProvider) ---

interface DroppableMoreButtonProps {
  onClick: () => void;
  isWide: boolean;
  onDropToOther: (sourceList: string, sourceIndex: number) => void;
  setShowOtherElements: (show: boolean) => void;
  setIsWide: (isWide: boolean) => void;
}

function DroppableMoreButton({
  onClick,
  isWide,
  onDropToOther,
  setShowOtherElements,
  setIsWide,
}: DroppableMoreButtonProps) {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: DND_TYPE,
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
    drop: (item: DragItem) => {
      setShowOtherElements(true);
      setIsWide(true);
      if (item.sourceList !== 'other') {
        onDropToOther(item.sourceList, item.index);
      }
    },
  });

  return (
    <div ref={drop}>
      <StyledListItem
        onClick={onClick}
        sx={{
          justifyContent: 'flex-start',
          backgroundColor: isOver && canDrop
            ? 'rgba(255, 255, 255, 0.2)'
            : 'transparent',
          boxShadow: isOver && canDrop
            ? '0 0 12px rgba(255, 255, 255, 0.3)'
            : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <StyledListItemIcon>
          <Icon src="/icons/menu/plus.svg" alt="More" />
        </StyledListItemIcon>
        {isWide && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StyledListItemText primary={isOver && canDrop ? 'Drop here' : 'More'} />
          </Box>
        )}
      </StyledListItem>
    </div>
  );
}

// --- DroppableList Component ---

interface DroppableListProps {
  items: MenuItem[];
  listType: string;
  onItemClick: (id: string) => void;
  isOpen: boolean;
  isObjectsOpen: boolean;
  isWide: boolean;
  onDrop: (sourceList: string, sourceIndex: number, targetList: string, targetIndex: number) => void;
  layout?: 'list' | 'grid';
  onHoverMove?: (
    sourceList: string,
    sourceIndex: number,
    targetList: string,
    targetIndex: number
  ) => void;
  onDragStart?: () => void;
  onDragEnd?: (didDrop: boolean, moved: boolean) => void;
}

function DroppableList({
  items,
  listType,
  onItemClick,
  isOpen,
  isObjectsOpen,
  isWide,
  onDrop,
  layout = 'list',
  onHoverMove,
  onDragStart,
  onDragEnd,
}: DroppableListProps) {
  if (layout === 'grid') {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, p: 0.5 }}>
        {items.map((item, index) => (
          <Box key={item.id} sx={{ minWidth: 0 }}>
            <DraggableMenuItem
              item={item}
              index={index}
              listType={listType}
              onItemClick={onItemClick}
              isOpen={isOpen}
              isObjectsOpen={isObjectsOpen}
              isWide={isWide}
              layout="grid"
              onHoverMove={onHoverMove}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((item, index) => (
        <Box key={item.id}>
          <DraggableMenuItem
            item={item}
            index={index}
            listType={listType}
            onItemClick={onItemClick}
            isOpen={isOpen}
            isObjectsOpen={isObjectsOpen}
            isWide={isWide}
            onHoverMove={onHoverMove}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        </Box>
      ))}
      <DropZone
        targetList={listType}
        targetIndex={items.length}
        onDrop={onDrop}
      />
    </Box>
  );
}

// --- Main Menu Component ---

export function Menu() {
  const dispatch = useDispatch();
  const { isOpen } = useSelector((state: RootState) => state.modal.dashboardWindowModal);
  const { isOpen: isObjectsOpen } = useSelector(
    (state: RootState) => state.modal.objectManagerWindowModal
  );
  const { isLoading: isMatterportLoading } = useMatterport();

  const { data: userMenuData, isLoading: isLoadingUserMenu } = useGetUserMenuQuery();
  const [updateUserMenu] = useUpdateUserMenuMutation();

  const [customMenuItems, setCustomMenuItems] = useState<MenuItem[]>(defaultMenuItems);
  const [isWide, setIsWide] = useState(false);
  const [showOtherElements, setShowOtherElements] = useState(false);
  const isUpdatingUserMenu = useRef(false);
  const customMenuItemsRef = useRef<MenuItem[]>(defaultMenuItems);
  const dragSnapshotRef = useRef<MenuItem[] | null>(null);

  useEffect(() => {
    customMenuItemsRef.current = customMenuItems;
  }, [customMenuItems]);

  const getSectionItems = useCallback(
    (items: MenuItem[], section: MenuItem['section']) =>
      items
        .filter((item) => item.section === section)
        .sort((a, b) => a.order - b.order),
    []
  );

  const normalizeMenuItems = useCallback(
    (items: MenuItem[]) => {
      const mainItems = getSectionItems(items, 'main').map((item, index) => ({
        ...item,
        section: 'main' as const,
        order: index,
      }));
      const otherItems = getSectionItems(items, 'other').map((item, index) => ({
        ...item,
        section: 'other' as const,
        order: index,
      }));

      return [...mainItems, ...otherItems];
    },
    [getSectionItems]
  );

  const persistMenuItems = useCallback(
    async (items: MenuItem[]) => {
      const mainItems = getSectionItems(items, 'main');
      const otherItems = getSectionItems(items, 'other');
      const payload: UserMenuPayload[] = [
        ...mainItems.map((item, index) => ({
          name: item.name,
          order: index,
          enabled: true,
        })),
        ...otherItems.map((item, index) => ({
          name: item.name,
          order: index,
          enabled: false,
        })),
      ];

      try {
        isUpdatingUserMenu.current = true;
        await updateUserMenu(payload).unwrap();
      } catch (err) {
        console.error('Failed to update user menu:', err);
      } finally {
        isUpdatingUserMenu.current = false;
      }
    },
    [getSectionItems, updateUserMenu]
  );

  const moveMenuItem = useCallback(
    (
      items: MenuItem[],
      sourceList: string,
      sourceIndex: number,
      targetList: string,
      targetIndex: number
    ) => {
      const sourceSection = sourceList as MenuItem['section'];
      const targetSection = targetList as MenuItem['section'];
      const sourceItems = getSectionItems(items, sourceSection);
      const targetItems =
        sourceSection === targetSection ? sourceItems : getSectionItems(items, targetSection);

      const draggedItem = sourceItems[sourceIndex];
      if (!draggedItem) return null;

      if (sourceSection === targetSection) {
        const reorderedItems = [...sourceItems];
        reorderedItems.splice(sourceIndex, 1);
        let insertAt = targetIndex;
        if (sourceIndex < targetIndex) insertAt -= 1;
        reorderedItems.splice(insertAt, 0, draggedItem);

        const nextItems = [
          ...items.filter((item) => item.section !== sourceSection),
          ...reorderedItems.map((item, index) => ({
            ...item,
            section: sourceSection,
            order: index,
          })),
        ];
        return normalizeMenuItems(nextItems);
      }

      const nextSourceItems = [...sourceItems];
      const nextTargetItems = [...targetItems];
      nextSourceItems.splice(sourceIndex, 1);
      const clampedTargetIndex = Math.min(Math.max(0, targetIndex), nextTargetItems.length);
      nextTargetItems.splice(clampedTargetIndex, 0, {
        ...draggedItem,
        section: targetSection,
      });

      const untouchedItems = items.filter(
        (item) => item.section !== sourceSection && item.section !== targetSection
      );

      return normalizeMenuItems([
        ...untouchedItems,
        ...nextSourceItems.map((item, index) => ({
          ...item,
          section: sourceSection,
          order: index,
        })),
        ...nextTargetItems.map((item, index) => ({
          ...item,
          section: targetSection,
          order: index,
        })),
      ]);
    },
    [getSectionItems, normalizeMenuItems]
  );

  const menuItems = getSectionItems(customMenuItems, 'main');
  const otherItems = getSectionItems(customMenuItems, 'other');

  const applyMenuMove = useCallback(
    (
      sourceList: string,
      sourceIndex: number,
      targetList: string,
      targetIndex: number,
      items = customMenuItemsRef.current
    ) => {
      const nextItems = moveMenuItem(items, sourceList, sourceIndex, targetList, targetIndex);
      if (!nextItems) return null;

      setCustomMenuItems(nextItems);
      customMenuItemsRef.current = nextItems;
      return nextItems;
    },
    [moveMenuItem]
  );

  // Initialize from user menu API
  useEffect(() => {
    if (isUpdatingUserMenu.current) return;

    if (userMenuData?.data && userMenuData.data.length > 0) {
      const defaultItemMap = new Map(defaultMenuItems.map((item) => [item.name, item]));
      const configuredNames = new Set<string>();
      const configuredItems = [...userMenuData.data]
        .sort((a, b) => a.order - b.order)
        .map((item) => {
          const defaultItem = defaultItemMap.get(item.name);
          if (!defaultItem) return null;
          configuredNames.add(item.name);
          return {
            ...defaultItem,
            section: item.enabled ? 'main' as const : 'other' as const,
            order: item.order,
          };
        })
        .filter(Boolean) as MenuItem[];

      const missingItems = defaultMenuItems
        .filter((item) => !configuredNames.has(item.name))
        .map((item) => ({
          ...item,
          section: 'other' as const,
        }));

      setCustomMenuItems(normalizeMenuItems([...configuredItems, ...missingItems]));
    } else if (userMenuData && (!userMenuData.data || userMenuData.data.length === 0)) {
      setCustomMenuItems(normalizeMenuItems(defaultMenuItems));
    }
  }, [normalizeMenuItems, userMenuData]);

  const handleMenuItemClick = (itemId: string) => {
    dispatch(closeAllModals());
    setShowOtherElements(false);
    switch (itemId) {
      case 'dashboard': dispatch(openDashboardWindow()); break;
      case 'objects': dispatch(openObjectManagerWindow()); break;
      case 'tasks': dispatch(openTasksWindow()); break;
      case 'notifications': dispatch(openNotificationWindow()); break;
      case 'documents': dispatch(openDocumentsWindow()); break;
      case 'calendar': dispatch(openCalendarWindow()); break;
      case 'reconstruction': dispatch(openReconstructionWindow({ spaceId: 1 })); break;
      case 'spaces': dispatch(openSpacesWindow()); break;
    }
  };

  const handleMouseLeave = () => {
    if (!showOtherElements) setIsWide(false);
  };

  const handleOtherElementsClick = () => {
    setShowOtherElements(!showOtherElements);
    setIsWide(true);
  };

  const handleDragStart = useCallback(() => {
    dragSnapshotRef.current = customMenuItemsRef.current;
  }, []);

  const handleDragEnd = useCallback(
    async (didDrop: boolean, moved: boolean) => {
      if (!moved) {
        dragSnapshotRef.current = null;
        return;
      }

      if (!didDrop && dragSnapshotRef.current) {
        setCustomMenuItems(dragSnapshotRef.current);
        customMenuItemsRef.current = dragSnapshotRef.current;
        dragSnapshotRef.current = null;
        return;
      }

      dragSnapshotRef.current = null;
      await persistMenuItems(customMenuItemsRef.current);
    },
    [persistMenuItems]
  );

  const handleDrop = useCallback(
    async (sourceList: string, sourceIndex: number, targetList: string, targetIndex: number) => {
      const nextItems = applyMenuMove(
        sourceList,
        sourceIndex,
        targetList,
        targetIndex,
        customMenuItems
      );
      if (!nextItems) return;
      await persistMenuItems(nextItems);
    },
    [applyMenuMove, customMenuItems, persistMenuItems]
  );

  if (isLoadingUserMenu || isMatterportLoading) return null;

  return (
    <DndProvider backend={HTML5Backend}>
      <Box
        sx={{
          position: 'fixed',
          top: '50%',
          right: 0,
          transform: 'translateY(-50%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: '30px',
        }}
      >
        {/* Main Sidebar */}
        <StyledPaper
          className={isWide ? 'expanded' : ''}
          onMouseEnter={() => setIsWide(true)}
          onMouseLeave={handleMouseLeave}
        >
          {/* AI Agent - fixed at top */}
          <StyledListItem>
            <StyledListItemIcon>
              <Icon src="/icons/menu/white/ai-agent.svg" alt="AI Agent" />
            </StyledListItemIcon>
            {isWide && <StyledListItemText primary="AI Agent" />}
          </StyledListItem>
          <Box
            sx={{
              height: 2,
              bgcolor: '#FFFFFF',
              opacity: 0.5,
              borderRadius: '100px',
              mx: 1,
              my: 0,
            }}
          />

          {/* Draggable menu items */}
          <DroppableList
            items={menuItems}
            listType="main"
            onItemClick={handleMenuItemClick}
            isOpen={isOpen}
            isObjectsOpen={isObjectsOpen}
            isWide={isWide}
            onDrop={handleDrop}
            onHoverMove={applyMenuMove}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />

          <DroppableMoreButton
            onClick={handleOtherElementsClick}
            isWide={isWide}
            onDropToOther={(sourceList, sourceIndex) => {
              void handleDrop(sourceList, sourceIndex, 'other', otherItems.length);
            }}
            setShowOtherElements={setShowOtherElements}
            setIsWide={setIsWide}
          />
        </StyledPaper>

        {/* More Panel */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            position: 'fixed',
            top: '50%',
            right: '248px',
            width: '320px',
            transform: 'translateY(-50%)',
            zIndex: 10000,
          }}
        >

          <OtherElementsPaper className={showOtherElements ? '' : 'hidden'}>
            <Box sx={{ position: 'relative', width: '100%' }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  pl: 1,
                  minWidth: 'fit-content',
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: 'white',
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  More elements
                </Typography>
                <IconButton
                  onClick={() => {
                    setShowOtherElements(false);
                    setIsWide(false);
                  }}
                  sx={{ color: 'white', opacity: 0.75, '&:hover': { opacity: 1 } }}
                >
                  <Icon src="/icons/mattertag/cross.svg" alt="Close" />
                </IconButton>
              </Box>

              <DroppableList
                items={otherItems}
                listType="other"
                onItemClick={handleMenuItemClick}
                isOpen={isOpen}
                isObjectsOpen={isObjectsOpen}
                isWide={true}
                onDrop={handleDrop}
                onHoverMove={applyMenuMove}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                layout="grid"
              />
            </Box>
          </OtherElementsPaper>
        </Box>
      </Box>
    </DndProvider>
  );
}
// Build: Sun Mar 22 16:38:21 CET 2026
